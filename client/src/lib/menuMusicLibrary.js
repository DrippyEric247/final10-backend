/**
 * Savvy Universe menu music library.
 * Users will eventually pick any unlocked track as their default menu theme.
 */

export const MENU_MUSIC_TRACKS = Object.freeze({
  final10_beta_theme: Object.freeze({
    id: 'final10_beta_theme',
    label: 'Final10 Beta Theme',
    src: '/audio/menu/final10-beta-theme.mp3',
    default: true,
    unlocked: true,
  }),
  // Future unlocks (not yet available):
  // savvy_universe_v1, savvy_universe_v2, season_1, season_2,
  // holiday, halloween, anniversary, community_favorites
});

export const DEFAULT_MENU_TRACK_ID = 'final10_beta_theme';

/** Routes where dedicated gameplay / feature music takes over. */
export const MENU_MUSIC_BLOCKLIST_PREFIXES = Object.freeze([
  '/perk-machine',
  '/scout-flight',
  '/egg-exchange',
  '/build-wars',
  '/onboarding',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/',
]);

/**
 * Menu zones — background music plays while browsing these areas.
 * Prefix match except `/` which is exact home only.
 */
export const MENU_MUSIC_ALLOW_PREFIXES = Object.freeze([
  '/',
  '/alerts',
  '/local-deals',
  '/auctions',
  '/auction/',
  '/feed',
  '/trending',
  '/scanner',
  '/seller-trends',
  '/win-feed',
  '/profile',
  '/leaderboard',
  '/mission-log',
  '/customization',
  '/founding-tester',
  '/founding-hall',
  '/shop/',
  '/premium',
  '/pricing',
  '/settings',
  '/events',
  '/points',
  '/daily-streak',
  '/battle-pass',
]);

export function getMenuTrack(trackId = DEFAULT_MENU_TRACK_ID) {
  return MENU_MUSIC_TRACKS[trackId] || MENU_MUSIC_TRACKS[DEFAULT_MENU_TRACK_ID];
}

export function isMenuMusicBlocked(pathname = '') {
  const path = String(pathname || '').split('?')[0].split('#')[0];
  return MENU_MUSIC_BLOCKLIST_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix)
  );
}

export function isMenuMusicRoute(pathname = '') {
  const path = String(pathname || '').split('?')[0].split('#')[0];
  if (!path || isMenuMusicBlocked(path)) return false;
  if (path === '/') return true;
  return MENU_MUSIC_ALLOW_PREFIXES.some(
    (prefix) => prefix !== '/' && (path === prefix || path.startsWith(prefix))
  );
}
