/**
 * Sound hooks for Savvy Scout Flight — emits events and ducks gameplay music.
 */

import {
  duckScoutFlightMusicForDuration,
  SCOUT_FLIGHT_MUSIC_DUCK,
} from './scoutFlightMusicEngine';

export const SCOUT_FLIGHT_SOUNDS = Object.freeze({
  FLAP: 'flap',
  COIN: 'coin',
  COMBO: 'combo',
  CRASH: 'crash',
  NEW_BEST: 'new_best',
  COUNTDOWN: 'countdown',
  TOURNAMENT_START: 'tournament_start',
  REWARD: 'reward',
});

/** @typedef {keyof typeof SCOUT_FLIGHT_SOUNDS extends infer K ? Lowercase<K> : never} ScoutFlightSoundType */

const MUSIC_DUCK_BY_SOUND = Object.freeze({
  [SCOUT_FLIGHT_SOUNDS.NEW_BEST]: {
    reason: SCOUT_FLIGHT_MUSIC_DUCK.PERSONAL_BEST,
    ms: 2800,
  },
  [SCOUT_FLIGHT_SOUNDS.COUNTDOWN]: {
    reason: SCOUT_FLIGHT_MUSIC_DUCK.COUNTDOWN,
    ms: 3200,
  },
  [SCOUT_FLIGHT_SOUNDS.TOURNAMENT_START]: {
    reason: SCOUT_FLIGHT_MUSIC_DUCK.TOURNAMENT_START,
    ms: 2400,
  },
  [SCOUT_FLIGHT_SOUNDS.REWARD]: {
    reason: SCOUT_FLIGHT_MUSIC_DUCK.REWARD,
    ms: 3600,
  },
});

/**
 * Emit a sound event (CustomEvent + dev log). Ducks gameplay music when configured.
 * @param {string} type
 * @param {Record<string, unknown>} [meta]
 */
export function emitScoutFlightSound(type, meta = {}) {
  const duckCfg = MUSIC_DUCK_BY_SOUND[type];
  if (duckCfg) {
    duckScoutFlightMusicForDuration(duckCfg.reason, duckCfg.ms);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('f10:scout-flight-sound', { detail: { type, ...meta } })
    );
  }
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[ScoutFlight sound]', type, meta);
  }
}

/**
 * Voice / narration priority hook — duck gameplay music while Scout speaks.
 * @param {number} [durationMs]
 */
export function duckScoutFlightForVoice(durationMs = 3200) {
  duckScoutFlightMusicForDuration(SCOUT_FLIGHT_MUSIC_DUCK.VOICE_LINE, durationMs);
}

/** @param {string} _type */
export function playScoutFlightSoundPlaceholder(_type) {
  /* Replace with Howler / WebAudio when sfx assets land. */
}
