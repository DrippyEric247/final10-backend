/**
 * Singleton Perk Machine music engine — loop, fade, duck; shares menu music settings.
 */

import {
  getMenuMusicVolume,
  isMenuMusicEnabled,
  MENU_MUSIC_SETTINGS_EVENT,
} from './menuMusicEngine';
import {
  DEFAULT_PERK_TRACK_ID,
  getPerkTrack,
} from './perkMachineMusicLibrary';

const STORAGE_TRACK = 'f10_perk_machine_music_track';
const SESSION_KEY = 'f10_perk_machine_music_session_v1';

export const PERK_MUSIC_DUCK = Object.freeze({
  REWARD: 'reward',
  LEGENDARY: 'legendary',
  VOICE_LINE: 'voice_line',
  SPIN_COMPLETE: 'spin_complete',
  SPIN: 'spin_sfx',
  JACKPOT: 'jackpot',
  MULTIPLIER: 'multiplier',
});

const FADE_TICK_MS = 32;

const DUCK_LEVELS = Object.freeze({
  [PERK_MUSIC_DUCK.REWARD]: 0.3,
  [PERK_MUSIC_DUCK.LEGENDARY]: 0.22,
  [PERK_MUSIC_DUCK.VOICE_LINE]: 0.28,
  [PERK_MUSIC_DUCK.SPIN_COMPLETE]: 0.32,
  [PERK_MUSIC_DUCK.SPIN]: 0.38,
  [PERK_MUSIC_DUCK.JACKPOT]: 0.2,
  [PERK_MUSIC_DUCK.MULTIPLIER]: 0.26,
});

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0.55;
  return Math.min(1, Math.max(0, v));
}

function readTrackId() {
  if (typeof window === 'undefined') return DEFAULT_PERK_TRACK_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_TRACK);
    if (!raw) return DEFAULT_PERK_TRACK_ID;
    return getPerkTrack(raw).id;
  } catch {
    return DEFAULT_PERK_TRACK_ID;
  }
}

class PerkMachineMusicEngine {
  audio = null;

  fadeTimer = null;

  trackId = DEFAULT_PERK_TRACK_ID;

  /** @type {Map<string, number>} */
  duckReasons = new Map();

  playing = false;

  active = false;

  preloaded = false;

  loadFailed = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.trackId = readTrackId();
      window.addEventListener(MENU_MUSIC_SETTINGS_EVENT, () => {
        if (!isMenuMusicEnabled()) {
          void this.stop({ fadeMs: 400 });
          this.markActive(false);
        } else if (this.audio && this.playing) {
          this.fadeVolumeTo(this.getTargetVolume(), 200);
        }
      });
    }
  }

  isActive() {
    return this.active;
  }

  isPlaying() {
    return this.playing;
  }

  markActive(on) {
    this.active = Boolean(on);
  }

  getTargetVolume() {
    if (!isMenuMusicEnabled()) return 0;
    let duckMul = 1;
    for (const reason of this.duckReasons.keys()) {
      const level = DUCK_LEVELS[reason] ?? 0.3;
      duckMul = Math.min(duckMul, level);
    }
    return getMenuMusicVolume() * duckMul;
  }

  ensureAudio() {
    if (typeof window === 'undefined') return null;
    const track = getPerkTrack(this.trackId);
    if (!this.audio) {
      this.audio = new Audio(track.src);
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.volume = 0;
    } else if (this.audio.src && !this.audio.src.endsWith(track.src)) {
      this.audio.src = track.src;
    }
    return this.audio;
  }

  clearFade() {
    if (this.fadeTimer) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  applyVolume(from, to, fadeMs) {
    const audio = this.audio;
    if (!audio) return;
    this.clearFade();
    if (fadeMs <= 0) {
      audio.volume = clamp01(to);
      return;
    }
    const start = clamp01(from);
    const end = clamp01(to);
    const steps = Math.max(1, Math.round(fadeMs / FADE_TICK_MS));
    let step = 0;
    audio.volume = start;
    this.fadeTimer = window.setInterval(() => {
      step += 1;
      const t = step / steps;
      audio.volume = start + (end - start) * t;
      if (step >= steps) {
        audio.volume = end;
        this.clearFade();
      }
    }, FADE_TICK_MS);
  }

  fadeVolumeTo(targetVolume, fadeMs = 500) {
    const audio = this.audio;
    if (!audio) return;
    this.applyVolume(audio.volume, targetVolume, fadeMs);
  }

  preload(trackId = this.trackId) {
    if (typeof window === 'undefined') return Promise.resolve(false);
    this.trackId = getPerkTrack(trackId).id;
    const audio = this.ensureAudio();
    if (!audio) return Promise.resolve(false);
    if (this.preloaded && !this.loadFailed) return Promise.resolve(true);

    return new Promise((resolve) => {
      const finish = (ok) => {
        this.preloaded = true;
        this.loadFailed = !ok;
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('error', onError);
        resolve(ok);
      };
      const onReady = () => finish(true);
      const onError = () => finish(false);

      if (audio.readyState >= 3) {
        finish(true);
        return;
      }
      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });
      try {
        audio.load();
      } catch {
        finish(false);
      }
    });
  }

  play({ fadeMs = 1500, fromStart = false } = {}) {
    if (typeof window === 'undefined' || !isMenuMusicEnabled()) return Promise.resolve(false);
    const audio = this.ensureAudio();
    if (!audio || this.loadFailed) return Promise.resolve(false);

    let freshSession = false;
    try {
      freshSession = !window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      freshSession = false;
    }

    const shouldRestart = fromStart && freshSession;
    if (shouldRestart) {
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      try {
        window.sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
    }

    const startVol = shouldRestart ? 0 : audio.volume;
    this.applyVolume(startVol, this.getTargetVolume(), fadeMs);

    return new Promise((resolve) => {
      try {
        const p = audio.play();
        this.playing = true;
        if (p && typeof p.then === 'function') {
          p.then(() => resolve(true)).catch(() => {
            this.playing = false;
            resolve(false);
          });
        } else {
          resolve(true);
        }
      } catch {
        this.playing = false;
        resolve(false);
      }
    });
  }

  pause({ fadeMs = 900 } = {}) {
    const audio = this.audio;
    if (!audio || !this.playing) return Promise.resolve();
    return new Promise((resolve) => {
      const from = audio.volume;
      this.applyVolume(from, 0, fadeMs);
      window.setTimeout(() => {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
        this.playing = false;
        resolve();
      }, fadeMs);
    });
  }

  stop({ fadeMs = 800 } = {}) {
    const audio = this.audio;
    if (!audio) {
      this.playing = false;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const from = audio.volume;
      this.applyVolume(from, 0, fadeMs);
      window.setTimeout(() => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
          /* ignore */
        }
        this.playing = false;
        resolve();
      }, fadeMs);
    });
  }

  duck(reason, level, fadeMs) {
    if (!reason) return;
    this.duckReasons.set(reason, typeof level === 'number' ? level : (DUCK_LEVELS[reason] ?? 0.3));
    if (this.audio && this.playing) {
      const downMs = typeof fadeMs === 'number' ? fadeMs : 350;
      this.fadeVolumeTo(this.getTargetVolume(), downMs);
    }
  }

  unduck(reason, fadeMs) {
    if (!reason) return;
    this.duckReasons.delete(reason);
    if (this.audio && this.playing) {
      const upMs = typeof fadeMs === 'number' ? fadeMs : 500;
      this.fadeVolumeTo(this.getTargetVolume(), upMs);
    }
  }

  duckForDuration(reason, ms, level) {
    this.duck(reason, level);
    window.setTimeout(() => this.unduck(reason), Math.max(0, Number(ms) || 0));
  }
}

export const perkMachineMusicEngine = new PerkMachineMusicEngine();

export function duckPerkMusic(reason, level) {
  perkMachineMusicEngine.duck(reason, level);
}

export function unduckPerkMusic(reason) {
  perkMachineMusicEngine.unduck(reason);
}

export function duckPerkMusicForDuration(reason, ms, level) {
  perkMachineMusicEngine.duckForDuration(reason, ms, level);
}
