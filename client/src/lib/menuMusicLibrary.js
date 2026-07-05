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

/**
 * Routes where dedicated gameplay / feature music takes over.
 * Scout Flight lobby uses menu music — gameplay crossfade is session-based.
 */
export const MENU_MUSIC_BLOCKLIST_PREFIXES = Object.freeze([
  '/onboarding',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/',
]);

/**
 * Menu zones — background music plays continuously while browsing these areas.
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
  '/seller-dashboard',
  '/savvy-shop',
  '/savvy-offers',
  '/savvy-programs',
  '/business-offers',
  '/build-wars',
  '/win-feed',
  '/profile',
  '/points',
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
  '/daily-streak',
  '/battle-pass',
  '/music-library',
  '/egg-exchange',
  '/scout-flight',
  '/monthly-report',
  '/party',
  '/create-auction',
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
    (prefix) => prefix !== '/' && (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix))
  );
}

/** Routes that intentionally override menu music with dedicated soundtracks. */
export function isDedicatedMusicOverrideRoute(pathname = '') {
  const path = String(pathname || '').split('?')[0].split('#')[0];
  return path === '/perk-machine' || path.startsWith('/perk-machine/');
}

/** Route music policies — menu keeps playing unless explicitly overridden or silent. */
export const MUSIC_ROUTE_POLICY = Object.freeze({
  KEEP_MENU: 'keep_menu',
  DEDICATED_OVERRIDE: 'dedicated_override',
  SILENT: 'silent',
});

function normalizeMusicPath(pathname = '') {
  return String(pathname || '').split('?')[0].split('#')[0];
}

/**
 * Resolve how background music should behave for a route.
 * Main app / profile / rewards / egg exchange → keep menu music playing.
 */
export function getMusicRoutePolicy(pathname = '') {
  const path = normalizeMusicPath(pathname);
  if (isDedicatedMusicOverrideRoute(path)) {
    return MUSIC_ROUTE_POLICY.DEDICATED_OVERRIDE;
  }
  if (!path || isMenuMusicBlocked(path)) {
    return MUSIC_ROUTE_POLICY.SILENT;
  }
  if (path === '/' || isMenuMusicRoute(path)) {
    return MUSIC_ROUTE_POLICY.KEEP_MENU;
  }
  return MUSIC_ROUTE_POLICY.SILENT;
}

export function shouldKeepMenuMusic(pathname = '') {
  return getMusicRoutePolicy(pathname) === MUSIC_ROUTE_POLICY.KEEP_MENU;
}
