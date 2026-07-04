/**
 * Orchestrates menu ↔ Perk Machine crossfades and unified ducking.
 */

import { isMenuMusicRoute } from './menuMusicLibrary';
import { isMenuMusicEnabled, menuMusicEngine } from './menuMusicEngine';
import { isPerkMachineRoute } from './perkMachineMusicLibrary';
import { perkMachineMusicEngine } from './perkMachineMusicEngine';

export const CROSSFADE_MS = 1500;

export function isPerkMusicActive() {
  return perkMachineMusicEngine.isActive();
}

export function duckAppMusic(reason, level) {
  if (perkMachineMusicEngine.isActive()) {
    perkMachineMusicEngine.duck(reason, level);
  } else if (menuMusicEngine.isPlaying()) {
    menuMusicEngine.duck(reason, level);
  }
}

export function unduckAppMusic(reason) {
  perkMachineMusicEngine.unduck(reason);
  menuMusicEngine.unduck(reason);
}

export function duckAppMusicForDuration(reason, ms, level) {
  duckAppMusic(reason, level);
  window.setTimeout(() => unduckAppMusic(reason), Math.max(0, Number(ms) || 0));
}

export async function preloadAppMusic() {
  await Promise.all([
    menuMusicEngine.preload(),
    perkMachineMusicEngine.preload(),
  ]);
}

/**
 * Crossfade menu music out while fading Perk Machine theme in.
 * Falls back gracefully if the perk asset is unavailable.
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

/**
 * Crossfade Perk Machine theme out while restoring menu ambience.
 */
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

export { isPerkMachineRoute, isMenuMusicRoute };
