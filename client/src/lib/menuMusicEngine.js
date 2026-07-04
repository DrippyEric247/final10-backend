/**
 * Singleton menu music engine — fade, loop, duck, volume, preload.
 */

import {
  DEFAULT_MENU_TRACK_ID,
  getMenuTrack,
} from './menuMusicLibrary';

const STORAGE_ENABLED = 'f10_menu_music_enabled';
const STORAGE_VOLUME = 'f10_menu_music_volume';
const STORAGE_TRACK = 'f10_menu_music_track';
const SESSION_KEY = 'f10_menu_music_session_v1';

export const MENU_MUSIC_DUCK = Object.freeze({
  EVENT_ACTIVATION: 'event_activation',
  VOICE_LINE: 'voice_line',
  REWARD: 'reward',
  TUTORIAL: 'tutorial',
});

export const MENU_MUSIC_SETTINGS_EVENT = 'f10:menu-music-settings';

const DEFAULT_VOLUME = 0.55;
const FADE_TICK_MS = 32;

const DUCK_LEVELS = Object.freeze({
  [MENU_MUSIC_DUCK.EVENT_ACTIVATION]: 0.18,
  [MENU_MUSIC_DUCK.VOICE_LINE]: 0.28,
  [MENU_MUSIC_DUCK.REWARD]: 0.32,
  [MENU_MUSIC_DUCK.TUTORIAL]: 0.28,
});

function clamp01(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, v));
}

function readEnabled() {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_ENABLED);
    if (raw === null) return true;
    return raw === '1';
  } catch {
    return true;
  }
}

function readVolume() {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  try {
    const raw = window.localStorage.getItem(STORAGE_VOLUME);
    if (raw === null) return DEFAULT_VOLUME;
    return clamp01(raw);
  } catch {
    return DEFAULT_VOLUME;
  }
}

function readTrackId() {
  if (typeof window === 'undefined') return DEFAULT_MENU_TRACK_ID;
  try {
    const raw = window.localStorage.getItem(STORAGE_TRACK);
    if (!raw) return DEFAULT_MENU_TRACK_ID;
    return getMenuTrack(raw).id;
  } catch {
    return DEFAULT_MENU_TRACK_ID;
  }
}

function emitSettingsChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MENU_MUSIC_SETTINGS_EVENT));
}

class MenuMusicEngine {
  audio = null;

  fadeTimer = null;

  enabled = true;

  userVolume = DEFAULT_VOLUME;

  trackId = DEFAULT_MENU_TRACK_ID;

  /** @type {Map<string, number>} */
  duckReasons = new Map();

  playing = false;

  pausedForRoute = false;

  sessionStarted = false;

  preloaded = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.enabled = readEnabled();
      this.userVolume = readVolume();
      this.trackId = readTrackId();
    }
  }

  getEnabled() {
    return this.enabled;
  }

  getVolume() {
    return this.userVolume;
  }

  getTrackId() {
    return this.trackId;
  }

  isPlaying() {
    return this.playing;
  }

  setEnabled(on) {
    this.enabled = Boolean(on);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_ENABLED, this.enabled ? '1' : '0');
      } catch {
        /* ignore */
      }
    }
    emitSettingsChange();
    if (!this.enabled) {
      this.stop({ fadeMs: 500 });
    } else if (!this.pausedForRoute) {
      this.play({ fadeMs: 800, fromStart: false });
    }
  }

  setVolume(volume) {
    this.userVolume = clamp01(volume);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_VOLUME, String(this.userVolume));
      } catch {
        /* ignore */
      }
    }
    emitSettingsChange();
    this.applyVolume(this.audio?.volume ?? 0, this.getTargetVolume(), 0);
  }

  setTrackId(trackId) {
    const track = getMenuTrack(trackId);
    if (track.id === this.trackId) return;
    this.trackId = track.id;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_TRACK, this.trackId);
      } catch {
        /* ignore */
      }
    }
    this.destroyAudio();
    this.preloaded = false;
    emitSettingsChange();
    if (this.playing && !this.pausedForRoute) {
      this.play({ fadeMs: 600, fromStart: true });
    }
  }

  getTargetVolume() {
    if (!this.enabled) return 0;
    let duckMul = 1;
    for (const reason of this.duckReasons.keys()) {
      const level = DUCK_LEVELS[reason] ?? 0.3;
      duckMul = Math.min(duckMul, level);
    }
    return this.userVolume * duckMul;
  }

  ensureAudio() {
    if (typeof window === 'undefined') return null;
    const track = getMenuTrack(this.trackId);
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

  destroyAudio() {
    this.clearFade();
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.src = '';
      } catch {
        /* ignore */
      }
      this.audio = null;
    }
    this.playing = false;
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
    this.trackId = getMenuTrack(trackId).id;
    const audio = this.ensureAudio();
    if (!audio) return Promise.resolve(false);
    if (this.preloaded) return Promise.resolve(true);

    return new Promise((resolve) => {
      const done = () => {
        this.preloaded = true;
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('error', onReady);
        resolve(true);
      };
      const onReady = () => done();
      if (audio.readyState >= 3) {
        done();
        return;
      }
      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('error', onReady, { once: true });
      try {
        audio.load();
      } catch {
        done();
      }
    });
  }

  /**
   * @param {{ fadeMs?: number, fromStart?: boolean }} opts
   */
  play({ fadeMs = 2000, fromStart = false } = {}) {
    if (typeof window === 'undefined' || !this.enabled) return Promise.resolve(false);
    this.pausedForRoute = false;
    const audio = this.ensureAudio();
    if (!audio) return Promise.resolve(false);

    let freshSession = false;
    if (typeof window !== 'undefined') {
      try {
        freshSession = !window.sessionStorage.getItem(SESSION_KEY);
      } catch {
        freshSession = false;
      }
    }

    const shouldRestart = fromStart && freshSession;

    if (shouldRestart) {
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(SESSION_KEY, '1');
        } catch {
          /* ignore */
        }
      }
      this.sessionStarted = true;
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
    this.pausedForRoute = true;
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
    this.pausedForRoute = true;
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

  duck(reason, level) {
    if (!reason) return;
    this.duckReasons.set(reason, typeof level === 'number' ? level : (DUCK_LEVELS[reason] ?? 0.3));
    if (this.audio && this.playing) {
      this.applyVolume(this.audio.volume, this.getTargetVolume(), 350);
    }
  }

  unduck(reason) {
    if (!reason) return;
    this.duckReasons.delete(reason);
    if (this.audio && this.playing) {
      this.applyVolume(this.audio.volume, this.getTargetVolume(), 500);
    }
  }

  /** Resume after leaving gameplay zones without restarting track. */
  resumeFromPause({ fadeMs = 900 } = {}) {
    return this.play({ fadeMs, fromStart: false });
  }
}

export const menuMusicEngine = new MenuMusicEngine();

export function duckMenuMusic(reason, level) {
  menuMusicEngine.duck(reason, level);
}

export function unduckMenuMusic(reason) {
  menuMusicEngine.unduck(reason);
}

export function isMenuMusicEnabled() {
  return menuMusicEngine.getEnabled();
}

export function setMenuMusicEnabled(on) {
  menuMusicEngine.setEnabled(on);
}

export function getMenuMusicVolume() {
  return menuMusicEngine.getVolume();
}

export function setMenuMusicVolume(volume) {
  menuMusicEngine.setVolume(volume);
}
