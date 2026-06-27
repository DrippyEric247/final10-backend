/**
 * Universal Events registry — plug future live events in here.
 * Each entry defines metadata for the Events hub UI.
 */

const EVENT_TYPES = Object.freeze({
  SUPPLY_DROP: 'supply_drop',
  SAVVY_SALE: 'savvy_sale',
  SCOUT_SUPPORT: 'scout_support',
  DOUBLE_POINTS: 'double_points',
  TRIPLE_POINTS: 'triple_points',
  BETA: 'beta',
  SEASONAL: 'seasonal',
});

/** Static upcoming / seasonal placeholders (beta). Replace with DB scheduler later. */
const SCHEDULED_PLACEHOLDERS = Object.freeze([
  {
    id: 'seasonal_neon_hunt_s2',
    type: EVENT_TYPES.SEASONAL,
    title: 'Neon Hunt Season 2',
    icon: '🌃',
    description: 'Next Battle Pass season — new tiers, cosmetics, and live drops.',
    statusHint: 'upcoming',
    etaLabel: 'Coming soon',
  },
  {
    id: 'beta_community_drop',
    type: EVENT_TYPES.BETA,
    title: 'Community Supply Wave',
    icon: '📡',
    description: 'Global Max Supply Drops when the community hits deal milestones.',
    statusHint: 'upcoming',
    etaLabel: 'Beta watch',
  },
]);

module.exports = {
  EVENT_TYPES,
  SCHEDULED_PLACEHOLDERS,
};
