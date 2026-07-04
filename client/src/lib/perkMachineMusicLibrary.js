/**
 * Perk Machine soundtrack library — unlockable themes for the reward chamber.
 */

export const PERK_MACHINE_TRACKS = Object.freeze({
  default_theme: Object.freeze({
    id: 'default_theme',
    label: 'Default Theme',
    src: '/audio/music/perk-machine-theme.mp3',
    default: true,
    unlocked: true,
  }),
  // Future unlocks: halloween, holiday, anniversary, community
});

export const DEFAULT_PERK_TRACK_ID = 'default_theme';

export function getPerkTrack(trackId = DEFAULT_PERK_TRACK_ID) {
  return PERK_MACHINE_TRACKS[trackId] || PERK_MACHINE_TRACKS[DEFAULT_PERK_TRACK_ID];
}

export function isPerkMachineRoute(pathname = '') {
  const path = String(pathname || '').split('?')[0].split('#')[0];
  return path === '/perk-machine' || path.startsWith('/perk-machine/');
}
