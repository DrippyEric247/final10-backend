/**
 * Perk Machine Nuke Event SFX hooks — assets optional, fail silently.
 */

import { isSoundMuted } from './savvyWalletSound';
import { duckPerkMusic, PERK_MUSIC_DUCK, unduckPerkMusic } from './perkMachineMusicEngine';

/** @typedef {'discovery'|'activation'|'siren'|'background'|'instability'|'final60'|'multiplier_hit'|'huge_reward'|'event_end'|'shockwave'} NukeSfxKey */

export const PERK_NUKE_SFX = Object.freeze({
  discovery: null,
  activation: null,
  siren: null,
  background: null,
  instability: null,
  final60: null,
  multiplier_hit: null,
  huge_reward: null,
  event_end: null,
  shockwave: null,
});

const loops = new Set(['siren', 'background', 'instability', 'final60']);

let sharedAudio = null;
const loopInstances = new Map();

function getAudio() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
}

function playOneShot(key) {
  const src = PERK_NUKE_SFX[key];
  if (!src || typeof window === 'undefined' || isSoundMuted()) {
    return Promise.resolve({ played: false });
  }
  const audio = getAudio();
  if (!audio) return Promise.resolve({ played: false });

  if (key === 'activation' || key === 'event_end' || key === 'shockwave') {
    duckPerkMusic(PERK_MUSIC_DUCK.JACKPOT, 0.22);
  }

  return new Promise((resolve) => {
    const onDone = () => {
      audio.removeEventListener('ended', onDone);
      audio.removeEventListener('error', onDone);
      if (key === 'activation' || key === 'event_end' || key === 'shockwave') {
        unduckPerkMusic(PERK_MUSIC_DUCK.JACKPOT);
      }
      resolve({ played: true });
    };
    audio.src = src;
    audio.loop = false;
    audio.currentTime = 0;
    audio.addEventListener('ended', onDone);
    audio.addEventListener('error', onDone);
    audio.play().catch(onDone);
  });
}

function startLoop(key) {
  const src = PERK_NUKE_SFX[key];
  if (!src || typeof window === 'undefined' || isSoundMuted() || !loops.has(key)) return;
  stopLoop(key);
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = 'auto';
  loopInstances.set(key, audio);
  audio.play().catch(() => {});
}

export function stopLoop(key) {
  const audio = loopInstances.get(key);
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  loopInstances.delete(key);
}

export function stopAllNukeLoops() {
  for (const key of [...loopInstances.keys()]) {
    stopLoop(key);
  }
}

export function playPerkNukeDiscoverySound() {
  return playOneShot('discovery');
}

export function playPerkNukeActivationSound() {
  stopAllNukeLoops();
  startLoop('siren');
  return playOneShot('activation');
}

export function playPerkNukeInstabilitySound() {
  startLoop('instability');
}

export function playPerkNukeFinal60Sound() {
  stopLoop('instability');
  startLoop('final60');
}

export function playPerkNukeMultiplierHitSound() {
  return playOneShot('multiplier_hit');
}

export function playPerkNukeHugeRewardSound() {
  return playOneShot('huge_reward');
}

export function playPerkNukeEventEndSound() {
  stopAllNukeLoops();
  return playOneShot('event_end');
}

export function playPerkNukeShockwaveSound() {
  return playOneShot('shockwave');
}

export function syncNukeAmbientAudio(nuke, { reducedMotion = false } = {}) {
  if (typeof window === 'undefined' || isSoundMuted() || reducedMotion) {
    stopAllNukeLoops();
    return;
  }
  const active = Boolean(nuke?.active);
  if (!active) {
    stopAllNukeLoops();
    return;
  }
  const phase = nuke.active.urgencyPhase || 'early';
  if (phase === 'final60') {
    playPerkNukeFinal60Sound();
  } else if (phase === 'final5min' || phase === 'mid') {
    playPerkNukeInstabilitySound();
  } else if (phase === 'early') {
    startLoop('background');
  }
}
