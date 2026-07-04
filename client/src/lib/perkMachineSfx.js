/**
 * Perk Machine one-shot SFX — spin, reels, rewards, and future stingers.
 * Missing assets fail silently; background music ducks during playback.
 */

import { isSoundMuted } from './savvyWalletSound';
import {
  duckPerkMusic,
  PERK_MUSIC_DUCK,
  unduckPerkMusic,
} from './perkMachineMusicEngine';
import { playMultiplierSound } from './perkMultiplierSound';
import { playTournamentTicketUnlockSound } from './tournamentTicketSound';

/** @typedef {'spin_start'|'reel_stop'|'reward_reveal'|'multiplier_activation'|'legendary_reward'|'scout_flight_ticket'} PerkSfxKey */

export const PERK_MACHINE_SFX = Object.freeze({
  spin_start: '/audio/sfx/perk-machine-spin.mp3',
  // Future official assets — wired now, enabled when files land in public/audio/sfx/
  reel_stop: null,
  reward_reveal: null,
  multiplier_activation: null,
  legendary_reward: null,
  scout_flight_ticket: null,
});

const DUCK_BY_KEY = Object.freeze({
  spin_start: { reason: PERK_MUSIC_DUCK.SPIN, level: 0.38 },
  reel_stop: { reason: PERK_MUSIC_DUCK.SPIN, level: 0.42 },
  reward_reveal: { reason: PERK_MUSIC_DUCK.REWARD, level: 0.34 },
  multiplier_activation: { reason: PERK_MUSIC_DUCK.MULTIPLIER, level: 0.3 },
  legendary_reward: { reason: PERK_MUSIC_DUCK.LEGENDARY, level: 0.24 },
  scout_flight_ticket: { reason: PERK_MUSIC_DUCK.JACKPOT, level: 0.28 },
});

let sharedAudio = null;
let activeKey = null;
let playSessionId = 0;
let spinSfxLock = false;

function getAudioElement() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

/**
 * @param {PerkSfxKey} key
 * @param {{ fallbackMs?: number, noRestart?: boolean }} opts
 * @returns {Promise<{ played: boolean, durationMs: number }>}
 */
function playPerkSfxAsset(key, { fallbackMs = 2200, noRestart = false } = {}) {
  const src = PERK_MACHINE_SFX[key];
  if (!src || typeof window === 'undefined') {
    return Promise.resolve({ played: false, durationMs: 0 });
  }
  if (isSoundMuted()) {
    return Promise.resolve({ played: false, durationMs: 0 });
  }

  if (noRestart && activeKey === key) {
    return Promise.resolve({ played: false, durationMs: 0 });
  }

  const audio = getAudioElement();
  if (!audio) {
    return Promise.resolve({ played: false, durationMs: 0 });
  }

  const duckCfg = DUCK_BY_KEY[key];
  const session = ++playSessionId;
  activeKey = key;

  if (duckCfg) {
    duckPerkMusic(duckCfg.reason, duckCfg.level);
  }

  return new Promise((resolve) => {
    let settled = false;
    const releaseDuck = () => {
      if (duckCfg) unduckPerkMusic(duckCfg.reason);
    };

    const finish = (played, durationMs) => {
      if (settled || session !== playSessionId) return;
      settled = true;
      if (activeKey === key) activeKey = null;
      if (key === 'spin_start') spinSfxLock = false;
      releaseDuck();
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      resolve({ played, durationMs: durationMs || fallbackMs });
    };

    const onEnded = () => {
      const ms = Math.round((Number(audio.duration) || 0) * 1000) || fallbackMs;
      finish(true, ms);
    };

    const onError = () => finish(false, 0);

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = src;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => finish(false, 0));
      }
    } catch {
      finish(false, 0);
    }
  });
}

/** Spin button tap — immediate power-up cue; no restart on double tap. */
export function playPerkMachineSpinSound() {
  if (spinSfxLock) {
    return Promise.resolve({ played: false, durationMs: 0 });
  }
  spinSfxLock = true;
  return playPerkSfxAsset('spin_start', { noRestart: true, fallbackMs: 2400 });
}

/** Each reel landing during the reveal sequence. */
export function playPerkReelStopSound() {
  return playPerkSfxAsset('reel_stop', { fallbackMs: 400 });
}

/** Final reward panel reveal. */
export function playPerkRewardRevealSound() {
  return playPerkSfxAsset('reward_reveal', { fallbackMs: 1200 });
}

/** 2× (or higher) multiplier tile activation. */
export function playPerkMultiplierActivationSound(factor = 2) {
  if (PERK_MACHINE_SFX.multiplier_activation) {
    return playPerkSfxAsset('multiplier_activation', { fallbackMs: 900 });
  }
  playMultiplierSound(factor);
  duckPerkMusic(PERK_MUSIC_DUCK.MULTIPLIER);
  window.setTimeout(() => unduckPerkMusic(PERK_MUSIC_DUCK.MULTIPLIER), 900);
  return Promise.resolve({ played: true, durationMs: 900 });
}

/** Legendary-tier pull stinger. */
export function playPerkLegendaryRewardSound() {
  if (PERK_MACHINE_SFX.legendary_reward) {
    return playPerkSfxAsset('legendary_reward', { fallbackMs: 3600 });
  }
  duckPerkMusic(PERK_MUSIC_DUCK.LEGENDARY);
  window.setTimeout(() => unduckPerkMusic(PERK_MUSIC_DUCK.LEGENDARY), 3600);
  return Promise.resolve({ played: false, durationMs: 3600 });
}

/** Scout Flight Tournament ticket awarded. */
export function playPerkScoutFlightTicketSound() {
  if (PERK_MACHINE_SFX.scout_flight_ticket) {
    return playPerkSfxAsset('scout_flight_ticket', { fallbackMs: 4200 });
  }
  playTournamentTicketUnlockSound();
  duckPerkMusic(PERK_MUSIC_DUCK.JACKPOT);
  window.setTimeout(() => unduckPerkMusic(PERK_MUSIC_DUCK.JACKPOT), 4200);
  return Promise.resolve({ played: true, durationMs: 4200 });
}

export function isPerkSpinSfxPlaying() {
  return spinSfxLock || activeKey === 'spin_start';
}

export function stopPerkMachineSfx() {
  playSessionId += 1;
  activeKey = null;
  spinSfxLock = false;
  if (sharedAudio) {
    try {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  unduckPerkMusic(PERK_MUSIC_DUCK.SPIN);
}
