/**
 * Final10 Live Event audio — play-on-tap (mobile-safe), once per activation.
 * Ducks menu music before the stinger, restores after playback ends.
 */

import {
  duckAppMusic,
  unduckAppMusic,
  EVENT_ACTIVATION_DUCK_LEVEL,
  EVENT_DUCK_DOWN_MS,
  EVENT_DUCK_UP_MS,
} from './appMusicCoordinator';
import { MENU_MUSIC_DUCK } from './menuMusicEngine';

export const EVENT_AUDIO = Object.freeze({
  double_points: '/audio/events/double-points.mp3',
  triple_points: '/audio/events/triple-points.mp3',
  savvy_sale: '/audio/events/savvy-sale.mp3',
  max_supply_drop: '/audio/events/max-supply-drop.mp3',
});

let sharedAudio = null;
let playingKey = null;
let playSessionId = 0;
let activationInFlight = false;

function getAudioElement() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Low-level event stinger — single shared Audio element, no menu ducking.
 * @returns {Promise<{ played: boolean, durationMs: number, skipped?: boolean }>}
 */
export function playEventAudio(audioKey, { fallbackMs = 3500 } = {}) {
  const key = String(audioKey || '').trim();
  const src = EVENT_AUDIO[key];

  if (!src || typeof window === 'undefined') {
    return Promise.resolve({ played: false, durationMs: fallbackMs });
  }

  if (playingKey) {
    return Promise.resolve({ played: false, durationMs: 0, skipped: true });
  }

  const audio = getAudioElement();
  if (!audio) {
    return Promise.resolve({ played: false, durationMs: fallbackMs });
  }

  const session = ++playSessionId;
  playingKey = key;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (played, durationMs) => {
      if (settled || session !== playSessionId) return;
      settled = true;
      if (playingKey === key) playingKey = null;
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      resolve({ played, durationMs: durationMs || fallbackMs });
    };

    const onEnded = () => {
      const ms = Math.round((Number(audio.duration) || 0) * 1000) || fallbackMs;
      finish(true, ms);
    };

    const onError = () => finish(false, fallbackMs);

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = src;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => finish(false, fallbackMs));
      }
    } catch {
      finish(false, fallbackMs);
    }
  });
}

/**
 * Duck menu music, play event activation audio, then restore menu volume.
 * Safe for all live events (Savvy Sale, Double/Triple Points, Max Supply Drop, future keys).
 *
 * @returns {Promise<{ played: boolean, durationMs: number, skipped?: boolean }>}
 */
export async function playEventActivationWithDuck(audioKey, { fallbackMs = 3500 } = {}) {
  if (activationInFlight || playingKey) {
    return { played: false, durationMs: 0, skipped: true };
  }

  activationInFlight = true;
  let ducked = false;

  try {
    duckAppMusic(MENU_MUSIC_DUCK.EVENT_ACTIVATION, EVENT_ACTIVATION_DUCK_LEVEL, {
      fadeMs: EVENT_DUCK_DOWN_MS,
    });
    ducked = true;

    await delay(EVENT_DUCK_DOWN_MS);

    return await playEventAudio(audioKey, { fallbackMs });
  } catch {
    return { played: false, durationMs: fallbackMs };
  } finally {
    activationInFlight = false;
    if (ducked) {
      unduckAppMusic(MENU_MUSIC_DUCK.EVENT_ACTIVATION, { fadeMs: EVENT_DUCK_UP_MS });
    }
  }
}

export function isEventAudioPlaying() {
  return Boolean(playingKey) || activationInFlight;
}

export function stopEventAudio() {
  playSessionId += 1;
  playingKey = null;
  activationInFlight = false;
  unduckAppMusic(MENU_MUSIC_DUCK.EVENT_ACTIVATION, { fadeMs: EVENT_DUCK_UP_MS });
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}
