/**
 * Scout Support (Deal Streak) — milestone definitions for beta live events.
 */

const SCOUT_SUPPORT_MILESTONES = Object.freeze([
  {
    milestone: 5,
    label: 'Max Supply Drop',
    icon: '📦',
    rewardType: 'supply_drop',
    description: 'Savvy Scout intercepts a reward crate.',
  },
  {
    milestone: 8,
    label: 'Savvy Sale Beacon',
    icon: '🔥',
    rewardType: 'savvy_sale',
    savvySaleMinutes: 15,
    description: 'Emergency Perk Machine pricing — all spins 10 Savvy.',
  },
  {
    milestone: 12,
    label: 'Rare Scout Flight Route Ticket',
    icon: '🚀',
    rewardType: 'placeholder',
    placeholderKey: 'rareScoutFlightRoute',
    description: 'Reserved for future Scout Flight routes.',
  },
  {
    milestone: 20,
    label: 'Mythic Supply Beacon',
    icon: '🥚',
    rewardType: 'placeholder',
    placeholderKey: 'mythicSupplyBeacon',
    description: 'Reserved for future Mythic supply events.',
  },
]);

const DEAL_ACTION_TYPES = Object.freeze([
  'best_move_viewed',
  'best_move_clicked',
  'deal_saved',
  'alert_clicked',
  'deal_secured_test',
]);

function findMilestoneConfig(count) {
  return SCOUT_SUPPORT_MILESTONES.find((m) => m.milestone === Number(count)) || null;
}

function nextMilestoneAfter(count) {
  const n = Number(count) || 0;
  return SCOUT_SUPPORT_MILESTONES.find((m) => m.milestone > n) || null;
}

module.exports = {
  SCOUT_SUPPORT_MILESTONES,
  DEAL_ACTION_TYPES,
  findMilestoneConfig,
  nextMilestoneAfter,
};
