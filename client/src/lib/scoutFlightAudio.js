/**
 * Sound-ready hooks for Savvy Scout Flight.
 * Wire real audio in one place by listening for `f10:scout-flight-sound`.
 */

export const SCOUT_FLIGHT_SOUNDS = Object.freeze({
  FLAP: 'flap',
  COIN: 'coin',
  COMBO: 'combo',
  CRASH: 'crash',
  NEW_BEST: 'new_best',
});

/** @typedef {'flap'|'coin'|'combo'|'crash'|'new_best'} ScoutFlightSoundType */

/**
 * Emit a sound event (CustomEvent + dev log). No audio files loaded yet.
 * @param {ScoutFlightSoundType} type
 * @param {Record<string, unknown>} [meta]
 */
export function emitScoutFlightSound(type, meta = {}) {
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
 * Optional helper for future AudioContext wiring.
 * @param {ScoutFlightSoundType} _type
 */
export function playScoutFlightSoundPlaceholder(_type) {
  /* Replace with Howler / WebAudio when assets land. */
}
