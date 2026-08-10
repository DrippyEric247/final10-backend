/**
 * Savvy Scout Flight — Nuke Flight audio hooks.
 *
 * Every asset path starts as null so the feature ships silent-but-working.
 * Dropping a file into SCOUT_FLIGHT_NUKE_SFX enables that cue with no other
 * code changes. Playback failures are always swallowed: audio never blocks
 * gameplay, and only one Nuke ambience loop can exist at a time.
 */

import {
  duckScoutFlightMusicForDuration,
  SCOUT_FLIGHT_MUSIC_DUCK,
  scoutFlightMusicEngine,
} from './scoutFlightMusicEngine';

export const SCOUT_FLIGHT_NUKE_SOUNDS = Object.freeze({
  WARNING: 'nuke_warning',
  FLASH: 'nuke_flash',
  BLAST: 'nuke_blast',
  ACTIVATION: 'nuke_activation',
  SIREN: 'nuke_siren',
  MUSIC: 'nuke_music',
  MULTIPLIER_UP: 'nuke_multiplier_up',
  STRUCTURE_DESTROYED: 'nuke_structure_destroyed',
  COLLAPSE: 'nuke_collapse',
  DEATH: 'nuke_death',
  RESULTS: 'nuke_results',
});

/** Populate with real asset URLs when the Nuke audio pack lands. */
export const SCOUT_FLIGHT_NUKE_SFX = Object.freeze({
  [SCOUT_FLIGHT_NUKE_SOUNDS.WARNING]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.FLASH]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.BLAST]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.ACTIVATION]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.MULTIPLIER_UP]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.STRUCTURE_DESTROYED]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.COLLAPSE]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.DEATH]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.RESULTS]: null,
});

/** Looping beds. Only one plays at a time. */
export const SCOUT_FLIGHT_NUKE_LOOPS = Object.freeze({
  [SCOUT_FLIGHT_NUKE_SOUNDS.SIREN]: null,
  [SCOUT_FLIGHT_NUKE_SOUNDS.MUSIC]: null,
});

export const SCOUT_FLIGHT_NUKE_AUDIO_EVENT = 'f10:scout-flight-nuke-sound';

const activeLoops = new Map();

function emit(type, meta) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(SCOUT_FLIGHT_NUKE_AUDIO_EVENT, { detail: { type, ...(meta || {}) } })
    );
  } catch {
    /* event bus is best-effort */
  }
}

function playOneShot(type, { volume = 0.85 } = {}) {
  emit(type);
  const src = SCOUT_FLIGHT_NUKE_SFX[type];
  if (!src || typeof Audio === 'undefined') return false;
  try {
    const el = new Audio(src);
    el.volume = volume;
    const done = () => {
      el.removeEventListener('ended', done);
      el.src = '';
    };
    el.addEventListener('ended', done);
    void el.play().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function startLoop(type, { volume = 0.5 } = {}) {
  if (activeLoops.has(type)) return true;
  const src = SCOUT_FLIGHT_NUKE_LOOPS[type];
  if (!src || typeof Audio === 'undefined') return false;
  try {
    const el = new Audio(src);
    el.loop = true;
    el.volume = volume;
    void el.play().catch(() => {});
    activeLoops.set(type, el);
    return true;
  } catch {
    return false;
  }
}

function stopLoop(type) {
  const el = activeLoops.get(type);
  if (!el) return;
  try {
    el.pause();
    el.src = '';
  } catch {
    /* ignore */
  }
  activeLoops.delete(type);
}

/** Stops every Nuke loop. Safe to call repeatedly; used on unmount and run end. */
export function stopAllNukeAudio() {
  for (const type of Array.from(activeLoops.keys())) stopLoop(type);
}

/** Pre-Nuke anomaly cue. `intensity` grows 1→6 as the threshold approaches. */
export function playNukeWarningSound(intensity = 1) {
  emit(SCOUT_FLIGHT_NUKE_SOUNDS.WARNING, { intensity });
  return playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.WARNING, {
    volume: Math.min(0.9, 0.25 + intensity * 0.1),
  });
}

/**
 * Nuke activation. Ducks the existing gameplay track and hands off to the Nuke
 * bed so two music layers never stack.
 */
export function playNukeActivationSequence() {
  playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.FLASH, { volume: 0.9 });
  playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.BLAST, { volume: 1 });
  playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.ACTIVATION);
  try {
    duckScoutFlightMusicForDuration(SCOUT_FLIGHT_MUSIC_DUCK.TOURNAMENT_START, 2600);
  } catch {
    /* ducking is optional */
  }
  const musicSwapped = startLoop(SCOUT_FLIGHT_NUKE_SOUNDS.MUSIC, { volume: 0.55 });
  if (musicSwapped) {
    try {
      void scoutFlightMusicEngine.pause?.({ fadeMs: 900 });
    } catch {
      /* ignore */
    }
  }
  startLoop(SCOUT_FLIGHT_NUKE_SOUNDS.SIREN, { volume: 0.35 });
}

export function playNukeMultiplierSound(multiplier = 2) {
  emit(SCOUT_FLIGHT_NUKE_SOUNDS.MULTIPLIER_UP, { multiplier });
  return playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.MULTIPLIER_UP, { volume: 0.6 });
}

export function playNukeStructureDestroyedSound() {
  return playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.STRUCTURE_DESTROYED, { volume: 0.4 });
}

export function playNukePhaseCollapseSound(phase) {
  emit(SCOUT_FLIGHT_NUKE_SOUNDS.COLLAPSE, { phase });
  return playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.COLLAPSE, { volume: 0.7 });
}

/** Death during Nuke Flight: kill the loops, hit the final blast. */
export function playNukeDeathSequence() {
  stopAllNukeAudio();
  return playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.DEATH, { volume: 1 });
}

export function playNukeResultsSound() {
  return playOneShot(SCOUT_FLIGHT_NUKE_SOUNDS.RESULTS, { volume: 0.7 });
}

/**
 * Routes engine events to audio. Central switchboard so the render loop never
 * needs to know which cue belongs to which event.
 */
export function handleNukeAudioEvent(event) {
  if (!event?.type) return;
  switch (event.type) {
    case 'nuke_warning':
      playNukeWarningSound(event.intensity);
      break;
    case 'nuke_activated':
      playNukeActivationSequence();
      break;
    case 'nuke_multiplier':
      playNukeMultiplierSound(event.multiplier);
      break;
    case 'nuke_structure_destroyed':
      playNukeStructureDestroyedSound();
      break;
    case 'nuke_phase':
      playNukePhaseCollapseSound(event.phase);
      break;
    case 'nuke_death':
      playNukeDeathSequence();
      break;
    case 'nuke_results':
      playNukeResultsSound();
      break;
    default:
      break;
  }
}
