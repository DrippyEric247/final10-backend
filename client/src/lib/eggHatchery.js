/**
 * Savvy Egg Hatchery — shared config for egg tiers, rarity styling,
 * Scout dialogue, and reward presentation.
 *
 * Designed to be extended by future systems (incubation timers, fusion,
 * evolution, egg levels/skins, seasonal eggs) without touching components.
 */

/**
 * Ordered, hatchable egg tiers. `inventoryKey` maps to the server
 * `eggInventory` field. Add new tiers here to surface them everywhere.
 */
export const EGG_TIERS = [
  {
    key: 'common',
    inventoryKey: 'common',
    name: 'Common Egg',
    color: '#e5e7eb',
    glow: 'rgba(255, 255, 255, 0.55)',
    aura: 'radial-gradient(circle at 50% 35%, #ffffff, #cbd5e1 60%, #94a3b8)',
    rank: 0,
    dialogue: "Let's see what we found.",
  },
  {
    key: 'rare',
    inventoryKey: 'rare',
    name: 'Rare Egg',
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.6)',
    aura: 'radial-gradient(circle at 50% 35%, #bfdbfe, #3b82f6 60%, #1d4ed8)',
    rank: 1,
    dialogue: "I've got a good feeling about this one.",
  },
  {
    key: 'epic',
    inventoryKey: 'epic',
    name: 'Epic Egg',
    color: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.62)',
    aura: 'radial-gradient(circle at 50% 35%, #e9d5ff, #a855f7 58%, #6b21a8)',
    rank: 2,
    dialogue: 'This one feels different...',
  },
  {
    key: 'legendary',
    inventoryKey: 'legendary',
    name: 'Legendary Egg',
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.7)',
    aura: 'radial-gradient(circle at 50% 35%, #fef9c3, #fbbf24 55%, #b45309)',
    rank: 3,
    dialogue: 'Operator... this could change everything.',
  },
  {
    key: 'mythic',
    inventoryKey: 'mythic',
    name: 'Mythic Egg',
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.65)',
    aura: 'radial-gradient(circle at 50% 35%, #fecdd3, #f43f5e 45%, #7c3aed)',
    rank: 4,
    dialogue: 'Energy levels are off the charts.',
  },
];

export const EGG_TIER_MAP = EGG_TIERS.reduce((acc, t) => {
  acc[t.key] = t;
  return acc;
}, {});

export function getEggTier(key) {
  return EGG_TIER_MAP[key] || EGG_TIERS[0];
}

/** Build owned-egg view models from a server eggInventory object. */
export function buildOwnedEggs(eggInventory = {}) {
  return EGG_TIERS.map((tier) => ({
    ...tier,
    owned: Number(eggInventory?.[tier.inventoryKey]) || 0,
  })).filter((tier) => tier.owned > 0);
}

export function totalOwnedEggs(eggInventory = {}) {
  return EGG_TIERS.reduce(
    (sum, tier) => sum + (Number(eggInventory?.[tier.inventoryKey]) || 0),
    0
  );
}

/**
 * Reward rarity → cinematic reveal styling.
 * `common`/`uncommon` are calm; `rare` gets gold spotlight + confetti;
 * `legendary` flashes the room gold; `mythic` triggers the full lightning show.
 */
export const REWARD_RARITY_FX = {
  common: { label: 'Common', color: '#cbd5e1', confetti: false, level: 'calm' },
  uncommon: { label: 'Uncommon', color: '#4ade80', confetti: false, level: 'calm' },
  rare: { label: 'Rare', color: '#60a5fa', confetti: true, level: 'rare' },
  legendary: { label: 'Legendary', color: '#fbbf24', confetti: true, level: 'legendary' },
  mythic: { label: 'Mythic', color: '#f43f5e', confetti: true, level: 'mythic' },
};

export function rewardFx(rarity) {
  return REWARD_RARITY_FX[rarity] || REWARD_RARITY_FX.common;
}

/**
 * Map an egg tier to the reveal intensity used for room-wide effects,
 * so even a modest reward from a Legendary egg still feels premium.
 */
export function revealLevelForEgg(eggKey) {
  const tier = getEggTier(eggKey);
  if (tier.rank >= 4) return 'mythic';
  if (tier.rank >= 3) return 'legendary';
  if (tier.rank >= 2) return 'rare';
  return 'calm';
}

/** Pick the stronger of the egg-driven and reward-driven reveal levels. */
export function resolveRevealLevel(eggKey, rewardRarity) {
  const order = { calm: 0, rare: 1, legendary: 2, mythic: 3 };
  const a = revealLevelForEgg(eggKey);
  const b = rewardFx(rewardRarity).level;
  return order[b] > order[a] ? b : a;
}

/** Scout celebration line shown on the reward reveal. */
export function scoutRevealLine(level) {
  switch (level) {
    case 'mythic':
      return '⚡ Operator... the energy is unreal. One for the history books.';
    case 'legendary':
      return '🎉 Legendary! Savvy Scout is celebrating with you.';
    case 'rare':
      return '✨ Rare find! Nicely done, Operator.';
    default:
      return '🤖 Logged and loaded. Onto the next one, Operator.';
  }
}
