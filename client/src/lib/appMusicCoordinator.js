/**
 * Orchestrates menu ↔ Perk Machine ↔ Scout Flight crossfades and unified ducking.
 */

import { isMenuMusicRoute, isDedicatedMusicOverrideRoute } from './menuMusicLibrary';
import { isMenuMusicEnabled, menuMusicEngine } from './menuMusicEngine';
import { isPerkMachineRoute } from './perkMachineMusicLibrary';
import { perkMachineMusicEngine } from './perkMachineMusicEngine';
import { isScoutFlightGameplayRoute } from './scoutFlightMusicLibrary';
import { scoutFlightMusicEngine } from './scoutFlightMusicEngine';

export const CROSSFADE_MS = 1500;

/** Menu duck during live-event activation stingers (~20% of user volume). */
export const EVENT_ACTIVATION_DUCK_LEVEL = 0.2;
export const EVENT_DUCK_DOWN_MS = 400;
export const EVENT_DUCK_UP_MS = 1000;

export function isScoutFlightMusicActive() {
  return scoutFlightMusicEngine.isActive();
}

export function isPerkMusicActive() {
  return perkMachineMusicEngine.isActive();
}

export function duckAppMusic(reason, level, opts = {}) {
  const fadeMs = opts.fadeMs;
  if (scoutFlightMusicEngine.isActive()) {
    scoutFlightMusicEngine.duck(reason, level, fadeMs);
  } else if (perkMachineMusicEngine.isActive()) {
    perkMachineMusicEngine.duck(reason, level, fadeMs);
  } else {
    menuMusicEngine.duck(reason, level, fadeMs);
  }
}

export function unduckAppMusic(reason, opts = {}) {
  const fadeMs = opts.fadeMs;
  scoutFlightMusicEngine.unduck(reason, fadeMs);
  perkMachineMusicEngine.unduck(reason, fadeMs);
  menuMusicEngine.unduck(reason, fadeMs);
}

export function duckAppMusicForDuration(reason, ms, level) {
  duckAppMusic(reason, level);
  window.setTimeout(() => unduckAppMusic(reason), Math.max(0, Number(ms) || 0));
}

export async function preloadAppMusic() {
  await Promise.all([
    menuMusicEngine.preload(),
    perkMachineMusicEngine.preload(),
    scoutFlightMusicEngine.preload('practice'),
  ]);
}

/**
 * Initialize app audio after sign-in — preload themes and attempt menu music.
 * @param {{ pathname?: string, fromLogin?: boolean }} [opts]
 */
export async function initializeAppAudioAfterAuth(opts = {}) {
  const pathname = opts.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  await preloadAppMusic();

  if (
    isMenuMusicRoute(pathname) &&
    !isDedicatedMusicOverrideRoute(pathname) &&
    !scoutFlightMusicEngine.isActive() &&
    isMenuMusicEnabled()
  ) {
    if (!menuMusicEngine.isPlaying()) {
      await menuMusicEngine.play({
        fadeMs: opts.fromLogin ? 1400 : 900,
        fromStart: Boolean(opts.fromLogin),
      });
    }
  }
}

/**
 * Start menu music when route + auth allow it (idempotent).
 * @param {{ pathname?: string, fadeMs?: number, fromStart?: boolean }} [opts]
 */
export async function tryStartMenuMusic(opts = {}) {
  const pathname = opts.pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (
    !isMenuMusicRoute(pathname) ||
    isDedicatedMusicOverrideRoute(pathname) ||
    scoutFlightMusicEngine.isActive() ||
    !isMenuMusicEnabled()
  ) {
    return false;
  }
  if (menuMusicEngine.isPlaying()) return true;
  return menuMusicEngine.play({
    fadeMs: opts.fadeMs ?? (menuMusicEngine.pausedForRoute ? 900 : 1600),
    fromStart: Boolean(opts.fromStart),
  });
}

/**
 * Crossfade menu music out while fading Perk Machine theme in.
 */
export async function enterPerkMachineMusic() {
  if (!isMenuMusicEnabled()) {
    await menuMusicEngine.pause({ fadeMs: CROSSFADE_MS });
    return false;
  }

  const loadOk = await perkMachineMusicEngine.preload();
  if (!loadOk || perkMachineMusicEngine.loadFailed) {
    await menuMusicEngine.pause({ fadeMs: CROSSFADE_MS });
    return false;
  }

  perkMachineMusicEngine.markActive(true);
  menuMusicEngine.pausedForRoute = true;

  const menuWasPlaying = menuMusicEngine.isPlaying();

  await perkMachineMusicEngine.play({ fadeMs: 0, fromStart: true });
  if (perkMachineMusicEngine.audio) {
    perkMachineMusicEngine.audio.volume = 0;
  }

  if (menuWasPlaying) {
    menuMusicEngine.fadeVolumeTo(0, CROSSFADE_MS);
    window.setTimeout(() => {
      if (menuMusicEngine.audio) {
        try {
          menuMusicEngine.audio.pause();
        } catch {
          /* ignore */
        }
        menuMusicEngine.playing = false;
      }
    }, CROSSFADE_MS);
  }

  perkMachineMusicEngine.fadeVolumeTo(
    perkMachineMusicEngine.getTargetVolume(),
    CROSSFADE_MS
  );

  return true;
}

export async function exitPerkMachineMusic(pathname = '') {
  perkMachineMusicEngine.markActive(false);
  menuMusicEngine.pausedForRoute = false;

  const shouldResumeMenu = isMenuMusicRoute(pathname) && isMenuMusicEnabled();
  const perkWasPlaying = perkMachineMusicEngine.isPlaying();

  if (!shouldResumeMenu) {
    if (perkWasPlaying) {
      await perkMachineMusicEngine.pause({ fadeMs: CROSSFADE_MS });
    }
    return;
  }

  if (perkWasPlaying) {
    perkMachineMusicEngine.fadeVolumeTo(0, CROSSFADE_MS);
  }

  await menuMusicEngine.play({ fadeMs: 0, fromStart: false });
  if (menuMusicEngine.audio) {
    menuMusicEngine.audio.volume = 0;
  }
  menuMusicEngine.fadeVolumeTo(menuMusicEngine.getTargetVolume(), CROSSFADE_MS);

  window.setTimeout(() => {
    void perkMachineMusicEngine.pause({ fadeMs: 0 });
  }, CROSSFADE_MS);
}

export async function startScoutFlightGameplayMusicFromGesture(mode = 'practice') {
  try {
    return await enterScoutFlightGameplayMusic(mode);
  } catch {
    return false;
  }
}

/**
 * @param {'practice'|'tournament'} mode
 */
export async function enterScoutFlightGameplayMusic(mode = 'practice') {
  if (!isMenuMusicEnabled()) {
    await menuMusicEngine.pause({ fadeMs: CROSSFADE_MS });
    return false;
  }

  const loadOk = await scoutFlightMusicEngine.preload(mode);
  if (!loadOk || scoutFlightMusicEngine.loadFailed) {
    return false;
  }

  scoutFlightMusicEngine.markActive(true);
  menuMusicEngine.pausedForRoute = true;

  const menuWasPlaying = menuMusicEngine.isPlaying();

  await scoutFlightMusicEngine.play({ fadeMs: 0, fromStart: true, mode });
  if (scoutFlightMusicEngine.audio) {
    scoutFlightMusicEngine.audio.volume = 0;
  }

  if (menuWasPlaying) {
    menuMusicEngine.fadeVolumeTo(0, CROSSFADE_MS);
    window.setTimeout(() => {
      if (menuMusicEngine.audio) {
        try {
          menuMusicEngine.audio.pause();
        } catch {
          /* ignore */
        }
        menuMusicEngine.playing = false;
      }
    }, CROSSFADE_MS);
  }

  scoutFlightMusicEngine.fadeVolumeTo(
    scoutFlightMusicEngine.getTargetVolume(),
    CROSSFADE_MS
  );

  return true;
}

/**
 * Fade out Scout Flight gameplay music; optionally restore menu theme.
 * @param {{ resumeMenu?: boolean, pathname?: string }} opts
 */
export async function exitScoutFlightGameplayMusic(opts = {}) {
  const { resumeMenu, pathname = '' } = opts;
  scoutFlightMusicEngine.markActive(false);
  menuMusicEngine.pausedForRoute = false;

  const shouldResumeMenu =
    typeof resumeMenu === 'boolean'
      ? resumeMenu
      : isMenuMusicRoute(pathname) && isMenuMusicEnabled();

  const wasPlaying = scoutFlightMusicEngine.isPlaying();

  if (wasPlaying) {
    scoutFlightMusicEngine.fadeVolumeTo(0, CROSSFADE_MS);
  }

  window.setTimeout(async () => {
    await scoutFlightMusicEngine.pause({ fadeMs: 0 });

    if (shouldResumeMenu) {
      await menuMusicEngine.play({ fadeMs: 0, fromStart: false });
      if (menuMusicEngine.audio) {
        menuMusicEngine.audio.volume = 0;
      }
      menuMusicEngine.fadeVolumeTo(menuMusicEngine.getTargetVolume(), CROSSFADE_MS);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('f10:scout-flight-music-ended'));
    }
  }, CROSSFADE_MS);
}

export { isPerkMachineRoute, isMenuMusicRoute, isScoutFlightGameplayRoute };
export { isDedicatedMusicOverrideRoute };
