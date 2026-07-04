/**
 * Final10 navigation menus — shared desktop + mobile structure.
 * Icons are attached in Navigation.js (Lucide components).
 */

import { PROFILE_NAV_PATH, NAV_ITEM_KEYS } from './primaryNavigation';

export const SCOUT_FLIGHT_PATH = '/scout-flight';

/** Short labels for narrow mobile columns */
export const NAV_SHORT_LABELS = Object.freeze({
  [NAV_ITEM_KEYS.home]: 'Home',
  [NAV_ITEM_KEYS.alerts]: 'Alerts',
  [NAV_ITEM_KEYS.quickSnipes]: 'Snipes',
  [NAV_ITEM_KEYS.auctions]: 'Auctions',
  [NAV_ITEM_KEYS.profile]: 'Profile',
  scoutFlight: 'Play & Earn',
  more: 'More',
});

export const MORE_MENU_SECTIONS = Object.freeze([
  {
    id: 'featured',
    title: 'Featured',
    items: [
      {
        key: 'scoutFlightFeatured',
        name: 'Savvy Scout Flight',
        shortLabel: 'Scout Flight',
        path: SCOUT_FLIGHT_PATH,
        badge: 'NEW',
        featured: true,
      },
    ],
  },
  {
    id: 'shopping',
    title: 'Shopping',
    items: [
      { key: 'bestMoves', name: 'Best Moves', shortLabel: 'Best Moves', path: '/feed' },
      {
        key: 'watchlist',
        name: 'Watchlist',
        shortLabel: 'Watchlist',
        path: '/auctions',
        search: '?watchlist=1',
      },
      { key: 'sellerDashboard', name: 'Seller Dashboard', shortLabel: 'Seller', path: '/seller-dashboard' },
      {
        key: 'savvyShop',
        name: 'My Savvy Shop',
        shortLabel: 'My Shop',
        path: '/savvy-shop/studio',
        requiresAuth: true,
      },
      { key: 'savvyOffers', name: 'Savvy Offers', shortLabel: 'Offers', path: '/savvy-offers' },
    ],
  },
  {
    id: 'progression',
    title: 'Progression',
    items: [
      { key: 'perkMachine', name: 'Perk Machine', shortLabel: 'Perks', path: '/perk-machine' },
      { key: 'battlePass', name: 'Battle Pass', shortLabel: 'Battle Pass', path: '/battle-pass' },
      {
        key: 'customization',
        name: 'Calling Cards & Emblems',
        shortLabel: 'Cards',
        path: '/customization',
      },
      { key: 'savvyWins', name: 'Savvy Wins', shortLabel: 'Savvy Wins', path: '/win-feed' },
      { key: 'leaderboards', name: 'Leaderboards', shortLabel: 'Ranks', path: '/leaderboard' },
    ],
  },
  {
    id: 'savvyUniverse',
    title: 'Savvy Universe',
    items: [
      { key: 'lifeOptimizer', name: 'Life Optimizer', shortLabel: 'Optimizer', path: '/business-offers' },
      { key: 'savvyPrograms', name: 'Savvy Programs', shortLabel: 'Programs', path: '/savvy-programs' },
      { key: 'foundingTester', name: 'Founding Tester', shortLabel: 'Tester', path: '/founding-tester' },
      {
        key: 'communityHub',
        name: 'Community Hub',
        shortLabel: 'Community',
        path: '/win-feed',
        hash: '#community-hub',
      },
      { key: 'settings', name: 'Settings', shortLabel: 'Settings', path: '/settings' },
    ],
  },
]);

export const ADMIN_MORE_ITEMS = Object.freeze([
  { key: 'admin', name: 'Admin', shortLabel: 'Admin', path: '/admin' },
  { key: 'shield', name: 'Shield', shortLabel: 'Shield', path: '/shield-dashboard' },
  { key: 'founderAdmin', name: 'Founder Admin', shortLabel: 'Founder', path: '/owner-control' },
]);

export { PROFILE_NAV_PATH };
