/**
 * Singleton Scout Flight gameplay music — loop, fade, duck; shares menu music settings.
 */

import {
  getMenuMusicVolume,
  isMenuMusicEnabled,
  MENU_MUSIC_SETTINGS_EVENT,
} from './menuMusicEngine';
import { getScoutFlightTrackSrc } from './scoutFlightMusicLibrary';

const SESSION_KEY = 'f10_scout_flight_music_session_v1';

export const SCOUT_FLIGHT_MUSIC_DUCK = Object.freeze({
  COUNTDOWN: 'countdown',
  TOURNAMENT_START: 'tournament_start',
  VOICE_LINE: 'voice_line',
  REWARD: 'reward',
  PERSONAL_BEST: 'personal_best',
  TOURNAMENT_COMPLETE: 'tournament_complete',
});

const FADE_TICK_MS = 32;

const DUCK_LEVELS = Object.freeze({
  [SCOUT_FLIGHT_MUSIC_DUCK.COUNTDOWN]: 0.26,
  [SCOUT_FLIGHT_MUSIC_DUCK.TOURNAMENT_START]: 0.32,
  [SCOUT_FLIGHT_MUSIC_DUCK.VOICE_LINE]: 0.28,
  [SCOUT_FLIGHT_MUSIC_DUCK.REWARD]: 0.3,
  [SCOUT_FLIGHT_MUSIC_DUCK.PERSONAL_BEST]: 0.24,
  [SCOUT_FLIGHT_MUSIC_DUCK.TOURNAMENT_COMPLETE]: 0.22,
});

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0.55;
  return Math.min(1, Math.max(0, v));
}

class ScoutFlightMusicEngine {
  audio = null;

  fadeTimer = null;

  /** @type {'practice'|'tournament'} */
  mode = 'practice';

  /** @type {Map<string, number>} */
  duckReasons = new Map();

  playing = false;

  active = false;

  preloaded = false;

  loadFailed = false;

  pausedForBackground = false;

  constructor() {
    if (typeof window !== 'undefined') {
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

  ensureAudio(mode = this.mode) {
    if (typeof window === 'undefined') return null;
    const src = getScoutFlightTrackSrc(mode);
    if (!src) return null;
    this.mode = mode === 'tournament' ? 'tournament' : 'practice';
    if (!this.audio) {
      this.audio = new Audio(src);
      this.audio.loop = true;
      this.audio.preload = 'auto';
      this.audio.volume = 0;
    } else if (this.audio.src && !this.audio.src.endsWith(src)) {
      this.audio.src = src;
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

  preload(mode = this.mode) {
    if (typeof window === 'undefined') return Promise.resolve(false);
    const audio = this.ensureAudio(mode);
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

  play({ fadeMs = 1500, fromStart = false, mode = this.mode } = {}) {
    if (typeof window === 'undefined' || !isMenuMusicEnabled()) {
      return Promise.resolve(false);
    }
    const audio = this.ensureAudio(mode);
    if (!audio || this.loadFailed) return Promise.resolve(false);

    this.pausedForBackground = false;

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

  pauseForBackground({ fadeMs = 400 } = {}) {
    if (!this.playing || this.pausedForBackground) return Promise.resolve();
    this.pausedForBackground = true;
    return this.pause({ fadeMs });
  }

  resumeFromPause({ fadeMs = 600 } = {}) {
    if (!this.pausedForBackground || !this.active) return Promise.resolve(false);
    this.pausedForBackground = false;
    return this.play({ fadeMs, fromStart: false, mode: this.mode });
  }

  stop({ fadeMs = 800 } = {}) {
    this.pausedForBackground = false;
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

export const scoutFlightMusicEngine = new ScoutFlightMusicEngine();

export function duckScoutFlightMusic(reason, level) {
  scoutFlightMusicEngine.duck(reason, level);
}

export function unduckScoutFlightMusic(reason) {
  scoutFlightMusicEngine.unduck(reason);
}

export function duckScoutFlightMusicForDuration(reason, ms, level) {
  scoutFlightMusicEngine.duckForDuration(reason, ms, level);
}
