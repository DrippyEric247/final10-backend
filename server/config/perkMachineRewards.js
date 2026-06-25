/**
 * Savvy Perk Machine V1 — reward pool, spin costs, weighted odds.
 */

const { normalizeTier } = require('./subscriptionPlans');

const SPIN_MODES = Object.freeze({
  FREE: 'free',
  PAID_1: 'paid_1',
  PAID_2: 'paid_2',
  PAID_3: 'paid_3',
});

const SPIN_COSTS = Object.freeze({
  [SPIN_MODES.FREE]: { savvy: 0, slots: 1 },
  [SPIN_MODES.PAID_1]: { savvy: 20, slots: 1 },
  [SPIN_MODES.PAID_2]: { savvy: 40, slots: 2 },
  [SPIN_MODES.PAID_3]: { savvy: 60, slots: 3 },
});

/** Base reward pool — weights are relative before tier adjustments. */
const REWARD_POOL = Object.freeze([
  { id: 'savvy_25', type: 'savvy', amount: 25, label: '+25 Savvy', icon: '🪙', rarity: 'common', weight: 18 },
  { id: 'savvy_50', type: 'savvy', amount: 50, label: '+50 Savvy', icon: '🪙', rarity: 'common', weight: 15 },
  { id: 'savvy_100', type: 'savvy', amount: 100, label: '+100 Savvy', icon: '💰', rarity: 'uncommon', weight: 10 },
  { id: 'savvy_250', type: 'savvy', amount: 250, label: '+250 Savvy', icon: '💎', rarity: 'rare', weight: 4 },
  { id: 'egg_common', type: 'egg', eggTier: 'common', label: 'Common Egg', icon: '🥚', rarity: 'common', weight: 16 },
  { id: 'egg_rare', type: 'egg', eggTier: 'rare', label: 'Rare Egg', icon: '🥚', rarity: 'uncommon', weight: 8 },
  { id: 'egg_epic', type: 'egg', eggTier: 'epic', label: 'Epic Egg', icon: '🥚', rarity: 'rare', weight: 3 },
  { id: 'egg_legendary', type: 'egg', eggTier: 'legendary', label: 'Legendary Egg', icon: '🥚', rarity: 'legendary', weight: 1 },
  {
    id: 'egg_extra_spin',
    type: 'egg',
    eggTier: 'extraFreeSpin',
    label: 'Extra Free Spin Egg',
    icon: '🎰',
    rarity: 'uncommon',
    weight: 7,
  },
  {
    id: 'token_bp_xp',
    type: 'token',
    tokenKey: 'battlePassXp15',
    label: '1.5× Battle Pass XP Token',
    icon: '⚡',
    rarity: 'rare',
    weight: 5,
  },
  {
    id: 'token_savvy_mult',
    type: 'token',
    tokenKey: 'savvyMultiplier15',
    label: '1.5× Savvy Token',
    icon: '✨',
    rarity: 'rare',
    weight: 5,
  },
  {
    id: 'streak_shield',
    type: 'streak_shield',
    label: 'Streak Shield',
    icon: '🛡️',
    rarity: 'uncommon',
    weight: 5,
  },
  {
    id: 'calling_card',
    type: 'calling_card',
    label: 'Calling Card Drop',
    icon: '🎖️',
    rarity: 'rare',
    weight: 3,
  },
]);

/**
 * Extra reward definitions only reachable by hatching eggs.
 * Kept separate from the spin pool so spins and hatches stay independent.
 */
const EXTRA_HATCH_REWARDS = Object.freeze([
  { id: 'savvy_500', type: 'savvy', amount: 500, label: '+500 Savvy', icon: '💎', rarity: 'legendary', weight: 1 },
  { id: 'free_spin', type: 'egg', eggTier: 'extraFreeSpin', label: 'Free Spin', icon: '🎰', rarity: 'uncommon', weight: 1 },
  { id: 'scout_upgrade', type: 'scout_upgrade', label: 'Savvy Scout Upgrade', icon: '🤖', rarity: 'legendary', weight: 1 },
]);

/** Fast lookup of every reward definition (spin pool + hatch-only rewards). */
const REWARD_BY_ID = Object.freeze(
  [...REWARD_POOL, ...EXTRA_HATCH_REWARDS].reduce((acc, r) => {
    acc[r.id] = r;
    return acc;
  }, {})
);

/** Egg tiers that can be hatched (extraFreeSpin is a spin token, not hatchable). */
const HATCHABLE_EGG_TIERS = Object.freeze(['common', 'rare', 'epic', 'legendary', 'mythic']);

/**
 * Per-egg-tier hatch reward tables. Higher tiers skew toward premium rewards.
 * Each entry references a reward id + a relative weight.
 */
const HATCH_POOLS = Object.freeze({
  common: [
    { id: 'savvy_25', weight: 20 },
    { id: 'savvy_50', weight: 12 },
    { id: 'token_savvy_mult', weight: 6 },
    { id: 'streak_shield', weight: 6 },
    { id: 'egg_common', weight: 5 },
    { id: 'free_spin', weight: 4 },
  ],
  rare: [
    { id: 'savvy_50', weight: 16 },
    { id: 'savvy_100', weight: 12 },
    { id: 'token_bp_xp', weight: 8 },
    { id: 'token_savvy_mult', weight: 8 },
    { id: 'streak_shield', weight: 6 },
    { id: 'calling_card', weight: 4 },
    { id: 'egg_rare', weight: 4 },
    { id: 'free_spin', weight: 4 },
  ],
  epic: [
    { id: 'savvy_100', weight: 16 },
    { id: 'savvy_250', weight: 8 },
    { id: 'token_bp_xp', weight: 10 },
    { id: 'token_savvy_mult', weight: 10 },
    { id: 'calling_card', weight: 6 },
    { id: 'egg_epic', weight: 4 },
    { id: 'scout_upgrade', weight: 3 },
    { id: 'free_spin', weight: 4 },
  ],
  legendary: [
    { id: 'savvy_250', weight: 16 },
    { id: 'savvy_500', weight: 6 },
    { id: 'token_bp_xp', weight: 10 },
    { id: 'token_savvy_mult', weight: 10 },
    { id: 'calling_card', weight: 10 },
    { id: 'scout_upgrade', weight: 8 },
    { id: 'egg_legendary', weight: 3 },
  ],
  mythic: [
    { id: 'savvy_500', weight: 14 },
    { id: 'scout_upgrade', weight: 14 },
    { id: 'calling_card', weight: 10 },
    { id: 'token_bp_xp', weight: 10 },
    { id: 'token_savvy_mult', weight: 10 },
    { id: 'egg_legendary', weight: 6 },
  ],
});

/**
 * Build a weighted reward pool for hatching a given egg tier.
 * Subscription tier nudges rare/legendary weights using the same boosts as spins.
 */
function buildHatchPool(eggTier, subscriptionTier) {
  const table = HATCH_POOLS[eggTier] || HATCH_POOLS.common;
  return table
    .map((entry) => {
      const def = REWARD_BY_ID[entry.id];
      if (!def) return null;
      const boosted = adjustedWeight({ ...def, weight: entry.weight }, subscriptionTier);
      return { ...def, weight: boosted };
    })
    .filter((r) => r && r.weight > 0);
}

const TIER_WEIGHT_BOOSTS = Object.freeze({
  free: { rare: 1, epic: 1, legendary: 1, uncommon: 1 },
  core: { rare: 1.12, epic: 1.15, legendary: 1.05, uncommon: 1.08 },
  premium: { rare: 1.12, epic: 1.15, legendary: 1.05, uncommon: 1.08 },
  pro: { rare: 1.2, epic: 1.28, legendary: 1.45, uncommon: 1.12 },
  elite: { rare: 1.2, epic: 1.28, legendary: 1.45, uncommon: 1.12 },
});

const RESULT_MESSAGES = Object.freeze({
  common: ['Nice pull, Operator.', 'Savvy Scout found something useful.', 'Solid drop from the machine.'],
  uncommon: ['Good find, Operator.', 'Savvy Scout likes this one.', 'Uncommon energy detected.'],
  rare: ['Rare drop detected.', 'Savvy Scout is impressed.', 'High-value pull confirmed.'],
  legendary: ['Legendary energy detected!', 'Jackpot pull, Operator!', 'Savvy Scout is celebrating.'],
});

const SPIN_COOLDOWN_MS = 4000;
const MAX_HISTORY = 40;

function getSpinConfig(mode) {
  return SPIN_COSTS[mode] || null;
}

function getTierBoosts(tier) {
  const t = normalizeTier(tier);
  return TIER_WEIGHT_BOOSTS[t] || TIER_WEIGHT_BOOSTS.free;
}

function adjustedWeight(reward, tier) {
  const boosts = getTierBoosts(tier);
  let mult = 1;
  if (reward.rarity === 'uncommon') mult = boosts.uncommon;
  else if (reward.rarity === 'rare') mult = boosts.rare;
  else if (reward.rarity === 'legendary') mult = boosts.legendary;
  else if (reward.type === 'egg' && reward.eggTier === 'epic') mult = boosts.epic;
  return Math.max(0, reward.weight * mult);
}

function buildWeightedPool(tier, forceRewardId = null) {
  if (forceRewardId) {
    const forced = REWARD_POOL.find((r) => r.id === forceRewardId);
    if (forced) return [{ ...forced, weight: 1 }];
  }
  return REWARD_POOL.map((r) => ({
    ...r,
    weight: adjustedWeight(r, tier),
  })).filter((r) => r.weight > 0);
}

function pickWeightedReward(pool, rng = Math.random) {
  const total = pool.reduce((sum, r) => sum + r.weight, 0);
  if (total <= 0) return { ...pool[0] };
  let roll = rng() * total;
  for (const reward of pool) {
    roll -= reward.weight;
    if (roll <= 0) return { ...reward };
  }
  return { ...pool[pool.length - 1] };
}

function pickResultMessage(rarity, rng = Math.random) {
  const list = RESULT_MESSAGES[rarity] || RESULT_MESSAGES.common;
  return list[Math.floor(rng() * list.length)];
}

function emptyEggInventory() {
  return {
    common: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
    mythic: 0,
    extraFreeSpin: 0,
  };
}

const HATCH_COOLDOWN_MS = 800;

module.exports = {
  SPIN_MODES,
  SPIN_COSTS,
  REWARD_POOL,
  REWARD_BY_ID,
  EXTRA_HATCH_REWARDS,
  HATCH_POOLS,
  HATCHABLE_EGG_TIERS,
  buildHatchPool,
  SPIN_COOLDOWN_MS,
  HATCH_COOLDOWN_MS,
  MAX_HISTORY,
  getSpinConfig,
  buildWeightedPool,
  pickWeightedReward,
  pickResultMessage,
  emptyEggInventory,
};
