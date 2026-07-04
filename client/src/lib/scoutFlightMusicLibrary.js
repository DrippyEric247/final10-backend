/**
 * Scout Flight gameplay music library — swappable per mode / season.
 */

export const SCOUT_FLIGHT_MUSIC = Object.freeze({
  practice: '/audio/music/scout-flight-theme.mp3',
  tournament: '/audio/music/scout-flight-theme.mp3',
  /** Reserved for a future tournament-exclusive soundtrack. */
  futureTournament: '/audio/music/scout-flight-championship.mp3',
});

/** @typedef {'practice'|'tournament'} ScoutFlightMusicMode */

/**
 * @param {ScoutFlightMusicMode | string | null | undefined} mode
 * @returns {string | null}
 */
export function getScoutFlightTrackSrc(mode) {
  const key = String(mode || 'practice').toLowerCase();
  if (key === 'tournament') {
    return SCOUT_FLIGHT_MUSIC.tournament;
  }
  return SCOUT_FLIGHT_MUSIC.practice;
}

export function isScoutFlightGameplayRoute(pathname = '') {
  const path = String(pathname || '').split('?')[0].split('#')[0];
  return path === '/scout-flight';
}
