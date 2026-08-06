/**
 * Savvy Scout voice playback — Web Audio API voice + subtle robot movement layer.
 * Reuses a single AudioContext; respects Voice On/Off and iOS autoplay unlock.
 */

import { unlockAudio, isAudioUnlocked, requestAudioPlayback } from './audioUnlockManager';
import {
  SCOUT_AUDIO,
  SCOUT_VOICE_LINES,
  SCOUT_VOICE_STATE_EVENT,
} from './scoutVoiceLines';
import { duckAppMusic, unduckAppMusic } from './appMusicCoordinator';
import { MENU_MUSIC_DUCK } from './menuMusicEngine';

const VOICE_PREF_KEY = 'f10_savvy_voice_on';

const VOICE_GAIN = 0.92;
const MOVEMENT_GAIN = 0.12;
const MASTER_GAIN = 0.94;
const MOVEMENT_LEAD_MS = 150;
const MOVEMENT_TAIL_MS = 200;
const FADE_IN_MS = 180;
const FADE_OUT_MS = 220;
const LOOP_CROSSFADE_MS = 120;
const ACCENT_GAIN = 0.1;
const ACCENT_MS = 280;

const IS_DEV = process.env.NODE_ENV !== 'production';

/** @type {AudioContext|null} */
let audioContext = null;
/** @type {GainNode|null} */
let masterGain = null;
/** @type {GainNode|null} */
let voiceGain = null;
/** @type {GainNode|null} */
let movementGain = null;

/** @type {Map<string, AudioBuffer>} */
const bufferCache = new Map();
let preloadPromise = null;
let voiceEnabled = readVoicePref();
let unlockBound = false;

/** @type {number} */
let playSession = 0;
/** @type {{ session: number, nodes: AudioNode[], timers: number[], utterance: SpeechSynthesisUtterance|null }|null} */
let activePlayback = null;

function devLog(event, detail) {
  if (!IS_DEV) return;
  // eslint-disable-next-line no-console
  console.log(`[SavvyScoutAudio] ${event}`, detail ?? '');
}

function readVoicePref() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(VOICE_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function emitSpeakingState(speaking) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SCOUT_VOICE_STATE_EVENT, {
      detail: { speaking, ts: Date.now() },
    })
  );
}

function getSynth() {
  if (typeof window === 'undefined') return null;
  return window.speechSynthesis || null;
}

function pickConfidentVoice(synth) {
  if (!synth) return null;
  const voices = synth.getVoices() || [];
  if (voices.length === 0) return null;
  const priority = [
    /Google US English/i,
    /Samantha/i,
    /Microsoft (Aria|Jenny|Guy)/i,
    /Alex/i,
    /Daniel/i,
  ];
  for (const pat of priority) {
    const match = voices.find((v) => pat.test(v.name) && /^en/i.test(v.lang));
    if (match) return match;
  }
  return (
    voices.find((v) => /en-US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  );
}

function ensureContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioContext) {
    audioContext = new AC();
    masterGain = audioContext.createGain();
    masterGain.gain.value = MASTER_GAIN;
    masterGain.connect(audioContext.destination);

    voiceGain = audioContext.createGain();
    voiceGain.gain.value = 0;
    voiceGain.connect(masterGain);

    movementGain = audioContext.createGain();
    movementGain.gain.value = 0;
    movementGain.connect(masterGain);
  }
  return audioContext;
}

function bindUnlockGestures() {
  if (unlockBound || typeof window === 'undefined') return;
  unlockBound = true;
  const onGesture = () => {
    void ensureScoutAudioUnlocked();
  };
  window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
  window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
  window.addEventListener('keydown', onGesture, { capture: true });
}

async function resumeContext() {
  const ctx = ensureContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  return ctx.state === 'running';
}

/**
 * Unlock shared AudioContext after first user interaction (iOS Safari safe).
 * @returns {Promise<boolean>}
 */
export async function ensureScoutAudioUnlocked() {
  bindUnlockGestures();
  if (isAudioUnlocked()) {
    return resumeContext();
  }
  return resumeContext();
}

async function loadBuffer(url) {
  const key = String(url || '').trim();
  if (!key) throw new Error('missing audio url');
  if (bufferCache.has(key)) return bufferCache.get(key);
  const ctx = ensureContext();
  if (!ctx) throw new Error('no audio context');
  const res = await fetch(key);
  if (!res.ok) throw new Error(`fetch failed: ${key}`);
  const arr = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(arr.slice(0));
  bufferCache.set(key, buf);
  return buf;
}

/**
 * @returns {Promise<void>}
 */
export function preloadScoutAudio() {
  if (typeof window === 'undefined') return Promise.resolve();
  bindUnlockGestures();
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      loadBuffer(SCOUT_AUDIO.movement).catch(() => null),
      loadBuffer(SCOUT_AUDIO.voiceSample).catch(() => null),
    ]).then(() => undefined);
  }
  return preloadPromise;
}

/**
 * @returns {boolean}
 */
export function isScoutVoiceEnabled() {
  return voiceEnabled;
}

/**
 * @param {boolean} enabled
 */
export function setScoutVoiceEnabled(enabled) {
  voiceEnabled = Boolean(enabled);
  if (!voiceEnabled) {
    stopScoutVoice({ reason: 'voice_disabled' });
  }
}

function clearActivePlayback(session) {
  if (!activePlayback || activePlayback.session !== session) return;
  activePlayback.timers.forEach((id) => {
    window.clearTimeout(id);
    window.clearInterval(id);
  });
  activePlayback.nodes.forEach((node) => {
    try {
      if (typeof node.stop === 'function') node.stop(0);
      node.disconnect?.();
    } catch {
      /* ignore */
    }
  });
  const synth = getSynth();
  if (activePlayback.utterance && synth) {
    try {
      synth.cancel();
    } catch {
      /* ignore */
    }
  }
  activePlayback = null;
}

function scheduleGainRamp(gainNode, from, to, startAt, durationSec) {
  const ctx = ensureContext();
  if (!ctx || !gainNode) return;
  gainNode.gain.cancelScheduledValues(startAt);
  gainNode.gain.setValueAtTime(Math.max(0.0001, from), startAt);
  gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, to), startAt + durationSec);
}

/**
 * @param {AudioBuffer} buffer
 * @param {number} session
 * @param {number} voiceEndAt - ctx.currentTime when voice ends (+ tail)
 */
function startMovementLayer(buffer, session, voiceEndAt) {
  const ctx = ensureContext();
  if (!ctx || !movementGain || !buffer) return;

  const now = ctx.currentTime;
  const leadSec = MOVEMENT_LEAD_MS / 1000;
  const fadeInSec = FADE_IN_MS / 1000;
  const fadeOutSec = FADE_OUT_MS / 1000;
  const tailSec = MOVEMENT_TAIL_MS / 1000;
  const loopCrossSec = LOOP_CROSSFADE_MS / 1000;
  const movementEnd = voiceEndAt + tailSec;
  const movementStart = Math.max(now, now + 0.01) - leadSec;

  /** @type {AudioNode[]} */
  const nodes = activePlayback?.nodes || [];

  const playSegment = (startAt, endAt, fadeIn = true, fadeOut = true) => {
    if (session !== playSession) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const segGain = ctx.createGain();
    src.connect(segGain);
    segGain.connect(movementGain);
    nodes.push(src, segGain);

    const peak = MOVEMENT_GAIN;
    segGain.gain.setValueAtTime(0.0001, startAt);
    if (fadeIn) {
      segGain.gain.linearRampToValueAtTime(peak, startAt + fadeInSec);
    } else {
      segGain.gain.setValueAtTime(peak, startAt);
    }
    if (fadeOut) {
      segGain.gain.setValueAtTime(peak, Math.max(startAt + fadeInSec, endAt - fadeOutSec));
      segGain.gain.linearRampToValueAtTime(0.0001, endAt);
    }
    src.start(startAt);
    src.stop(endAt + 0.05);
    src.onended = () => {
      try {
        src.disconnect();
        segGain.disconnect();
      } catch {
        /* ignore */
      }
    };
  };

  let cursor = movementStart;
  const segDuration = buffer.duration;
  let first = true;
  while (cursor < movementEnd - 0.02) {
    const segEnd = Math.min(cursor + segDuration, movementEnd);
    playSegment(cursor, segEnd, first, cursor + segDuration >= movementEnd - 0.02);
    if (segEnd >= movementEnd - 0.02) break;
    cursor = segEnd - loopCrossSec;
    first = false;
  }

  if (activePlayback) activePlayback.nodes = nodes;
  devLog('robot layer started', { session, movementEnd });
}

/**
 * Short movement accent between phrases — subtle, not constant noise.
 * @param {number} session
 */
async function playMovementAccent(session) {
  if (session !== playSession || !voiceEnabled) return;
  const buffer = await loadBuffer(SCOUT_AUDIO.movement).catch(() => null);
  const ctx = ensureContext();
  if (!buffer || !ctx || !movementGain) return;

  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const segGain = ctx.createGain();
  src.connect(segGain);
  segGain.connect(movementGain);
  if (activePlayback) activePlayback.nodes.push(src, segGain);

  const dur = Math.min(ACCENT_MS / 1000, buffer.duration);
  segGain.gain.setValueAtTime(0.0001, now);
  segGain.gain.linearRampToValueAtTime(ACCENT_GAIN, now + 0.08);
  segGain.gain.linearRampToValueAtTime(0.0001, now + dur);
  src.start(now);
  src.stop(now + dur + 0.02);
}

function resolveLine(opts = {}) {
  const { lineKey, text, voiceSrc } = opts;
  if (lineKey && SCOUT_VOICE_LINES[lineKey]) {
    const line = SCOUT_VOICE_LINES[lineKey];
    return {
      text: text || line.text,
      voiceSrc: voiceSrc || line.src || null,
    };
  }
  return {
    text: text || '',
    voiceSrc: voiceSrc || null,
  };
}

/**
 * @param {object} opts
 * @param {string} [opts.lineKey]
 * @param {string} [opts.text]
 * @param {string} [opts.voiceSrc]
 * @param {number} [opts.volume=1]
 * @param {boolean} [opts.movementAccent=false]
 * @param {() => void} [opts.onStart]
 * @param {() => void} [opts.onEnd]
 * @returns {Promise<boolean>}
 */
export async function playScoutVoice(opts = {}) {
  if (typeof window === 'undefined' || !voiceEnabled) return false;

  const { text, voiceSrc, volume = 1, movementAccent = false, onStart, onEnd } = resolveLine(opts);

  if (movementAccent) {
    const session = playSession;
    await preloadScoutAudio();
    const unlocked = await ensureScoutAudioUnlocked();
    if (!unlocked) {
      devLog('autoplay blocked', { accent: true });
      return false;
    }
    void playMovementAccent(session);
    return true;
  }

  if (!text && !voiceSrc) return false;

  stopScoutVoice({ reason: 'interrupted', fadeMs: 140 });

  const session = ++playSession;
  activePlayback = { session, nodes: [], timers: [], utterance: null };

  const started = await requestAudioPlayback(async () => {
    await preloadScoutAudio();
    const unlocked = await ensureScoutAudioUnlocked();
    if (!unlocked) {
      devLog('autoplay blocked');
      return false;
    }

    unlockAudio();
    duckAppMusic(MENU_MUSIC_DUCK.VOICE_LINE);
    void playMovementAccent(session);

    const movementBuffer = await loadBuffer(SCOUT_AUDIO.movement).catch(() => null);
    const ctx = ensureContext();
    if (!ctx || !voiceGain || !movementGain) return false;

    const now = ctx.currentTime;
    let voiceEndAt = now + 2.5;
    let voiceStarted = false;

    const finish = (reason) => {
      if (session !== playSession) return;
      void playMovementAccent(session);
      devLog(reason === 'voice_end' ? 'voice ended' : 'robot layer ended', { session, reason });
      clearActivePlayback(session);
      unduckAppMusic(MENU_MUSIC_DUCK.VOICE_LINE);
      emitSpeakingState(false);
      if (typeof onEnd === 'function') onEnd();
    };

    const markStart = () => {
      if (voiceStarted || session !== playSession) return;
      voiceStarted = true;
      emitSpeakingState(true);
      devLog('voice started', { session, voiceSrc: Boolean(voiceSrc), tts: Boolean(text && !voiceSrc) });
      if (typeof onStart === 'function') onStart();
    };

    try {
      if (voiceSrc) {
        const voiceBuffer = await loadBuffer(voiceSrc);
        const src = ctx.createBufferSource();
        src.buffer = voiceBuffer;
        src.connect(voiceGain);
        activePlayback.nodes.push(src);

        const peak = Math.min(1, VOICE_GAIN * volume);
        const startAt = now + 0.02;
        voiceEndAt = startAt + voiceBuffer.duration;
        scheduleGainRamp(voiceGain, 0.0001, peak, startAt, FADE_IN_MS / 1000);
        scheduleGainRamp(voiceGain, peak, 0.0001, voiceEndAt, FADE_OUT_MS / 1000);

        src.onended = () => finish('voice_end');
        src.start(startAt);
        src.stop(voiceEndAt + FADE_OUT_MS / 1000);
        markStart();
        if (movementBuffer) startMovementLayer(movementBuffer, session, voiceEndAt);
      } else if (text) {
        const synth = getSynth();
        if (!synth) return false;

        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickConfidentVoice(synth);
        if (voice) utterance.voice = voice;
        utterance.rate = 1.06;
        utterance.pitch = 0.98;
        utterance.volume = Math.min(1, volume);
        activePlayback.utterance = utterance;

        utterance.onstart = () => {
          markStart();
          if (movementBuffer) {
            voiceEndAt = ctx.currentTime + 3;
            startMovementLayer(movementBuffer, session, voiceEndAt);
          }
        };
        utterance.onboundary = (ev) => {
          if (ev.name === 'sentence' && session === playSession && Math.random() < 0.35) {
            void playMovementAccent(session);
          }
        };
        utterance.onend = () => finish('voice_end');
        utterance.onerror = () => finish('voice_error');

        try {
          synth.cancel();
          synth.speak(utterance);
        } catch {
          finish('voice_error');
          return false;
        }

        const poll = window.setInterval(() => {
          if (session !== playSession) {
            window.clearInterval(poll);
            return;
          }
          if (!synth.speaking && voiceStarted) {
            window.clearInterval(poll);
            finish('voice_end');
          }
        }, 120);
        activePlayback.timers.push(poll);
      }

      return true;
    } catch (err) {
      devLog('playback error', err);
      finish('error');
      return false;
    }
  });

  if (!started) {
    clearActivePlayback(session);
    emitSpeakingState(false);
  }
  return started;
}

/**
 * @param {{ fadeMs?: number, reason?: string }} [opts]
 */
export function stopScoutVoice(opts = {}) {
  const { fadeMs = FADE_OUT_MS, reason = 'user_stopped' } = opts;
  if (activePlayback) {
    devLog(reason === 'user_stopped' ? 'user stopped playback' : 'audio interrupted', { reason });
  }

  const prev = activePlayback;
  playSession += 1;

  if (prev) {
    prev.timers.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    prev.nodes.forEach((node) => {
      try {
        if (typeof node.stop === 'function') node.stop(0);
        node.disconnect?.();
      } catch {
        /* ignore */
      }
    });
    const synth = getSynth();
    if (prev.utterance && synth) {
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    }
    activePlayback = null;
  }

  const ctx = ensureContext();

  if (ctx && voiceGain && movementGain && fadeMs > 0) {
    const now = ctx.currentTime;
    const fadeSec = fadeMs / 1000;
    try {
      voiceGain.gain.cancelScheduledValues(now);
      voiceGain.gain.setValueAtTime(Math.max(voiceGain.gain.value, 0.0001), now);
      voiceGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
      movementGain.gain.cancelScheduledValues(now);
      movementGain.gain.setValueAtTime(Math.max(movementGain.gain.value, 0.0001), now);
      movementGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      if (voiceGain) voiceGain.gain.value = 0;
      if (movementGain) movementGain.gain.value = 0;
    }, fadeMs + 30);
  } else {
    if (voiceGain) voiceGain.gain.value = 0;
    if (movementGain) movementGain.gain.value = 0;
  }

  unduckAppMusic(MENU_MUSIC_DUCK.VOICE_LINE);
  emitSpeakingState(false);
}

/**
 * @param {(event: CustomEvent) => void} cb
 * @returns {() => void}
 */
export function subscribeScoutVoiceState(cb) {
  if (typeof window === 'undefined') return () => {};
  const handler = (event) => cb(event);
  window.addEventListener(SCOUT_VOICE_STATE_EVENT, handler);
  return () => window.removeEventListener(SCOUT_VOICE_STATE_EVENT, handler);
}

// Sync voice pref when assistant toggles it elsewhere.
if (typeof window !== 'undefined') {
  voiceEnabled = readVoicePref();
  window.addEventListener('storage', (e) => {
    if (e.key === VOICE_PREF_KEY) {
      setScoutVoiceEnabled(e.newValue === '1');
    }
  });
}
