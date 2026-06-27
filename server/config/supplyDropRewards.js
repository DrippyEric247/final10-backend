/**
 * Max Supply Drop — beta reward pool (server-weighted selection).
 */

const { pickWeightedReward } = require('./perkMachineRewards');

/** @type {import('./perkMachineRewards').RewardDef[]} */
const SUPPLY_DROP_POOL = Object.freeze([
  { id: 'drop_savvy_60', type: 'savvy', amount: 60, label: '+60 Savvy', icon: '🪙', rarity: 'uncommon', weight: 14 },
  { id: 'drop_free_spin', type: 'free_spin', label: 'Free Perk Machine Spin', icon: '🎰', rarity: 'uncommon', weight: 12 },
  {
    id: 'drop_paid3_token',
    type: 'token',
    tokenKey: 'paid3Spin',
    label: 'Free 3-Slot Spin Token',
    icon: '🎰',
    rarity: 'rare',
    weight: 8,
  },
  { id: 'drop_bp_xp_500', type: 'bp_xp', amount: 500, label: '+500 Battle Pass XP', icon: '⚡', rarity: 'rare', weight: 10 },
  { id: 'drop_player_xp_1000', type: 'player_xp', amount: 1000, label: '+1000 Player XP', icon: '⭐', rarity: 'uncommon', weight: 10 },
  { id: 'drop_egg_rare', type: 'egg', eggTier: 'rare', label: 'Rare Egg', icon: '🥚', rarity: 'rare', weight: 9 },
  {
    id: 'drop_egg_epic_chance',
    type: 'egg_chance_epic',
    label: 'Epic Egg Chance',
    icon: '🥚',
    rarity: 'epic',
    weight: 5,
    epicChance: 0.35,
  },
  { id: 'drop_streak_shield', type: 'streak_shield', label: 'Streak Shield', icon: '🛡️', rarity: 'uncommon', weight: 8 },
  {
    id: 'drop_token_savvy_2x',
    type: 'token',
    tokenKey: 'savvyMultiplier15',
    label: '2× Savvy Token',
    icon: '✨',
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'drop_token_bp_2x',
    type: 'token',
    tokenKey: 'battlePassXp15',
    label: '2× Battle Pass XP Token',
    icon: '⚡',
    rarity: 'rare',
    weight: 6,
  },
  {
    id: 'drop_scout_flight',
    type: 'placeholder',
    placeholderKey: 'scoutFlightTicket',
    label: 'Scout Flight Ticket',
    icon: '🎫',
    rarity: 'legendary',
    weight: 3,
  },
  {
    id: 'drop_calling_card',
    type: 'placeholder',
    placeholderKey: 'callingCardPlaceholder',
    label: 'Calling Card Drop',
    icon: '🎖️',
    rarity: 'rare',
    weight: 4,
  },
]);

const DEFAULT_CLAIM_WINDOW_MS = 10 * 60 * 1000;

function pickSupplyDropReward(forceRewardId = null) {
  const pool = SUPPLY_DROP_POOL.map((r) => ({ ...r, weight: r.weight || 1 }));
  if (forceRewardId) {
    const forced = pool.find((r) => r.id === forceRewardId);
    if (forced) return { ...forced };
  }
  return pickWeightedReward(pool);
}

function rewardToSummary(reward) {
  return {
    id: reward.id,
    type: reward.type,
    label: reward.label,
    icon: reward.icon || '🎁',
    rarity: reward.rarity || 'common',
    amount: reward.amount || null,
    eggTier: reward.eggTier || null,
    tokenKey: reward.tokenKey || null,
    placeholderKey: reward.placeholderKey || null,
  };
}

module.exports = {
  SUPPLY_DROP_POOL,
  DEFAULT_CLAIM_WINDOW_MS,
  pickSupplyDropReward,
  rewardToSummary,
};
