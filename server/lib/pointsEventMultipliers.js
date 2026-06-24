const { normalizeTier } = require('../config/subscriptionPlans');

/** Base global event multipliers (before tier bonus). */
const DOUBLE_POINTS_BASE = 2;
const TRIPLE_POINTS_BASE = 3;

/**
 * Extra % during Double/Triple Points events by subscription tier.
 * Premium (core): +10% → 2.2× / 3.3×
 * Pro (+ elite): +25% → 2.5× / 3.75×
 */
function getTierEventBonusPct(rawTier) {
  const tier = normalizeTier(rawTier);
  if (tier === 'pro' || tier === 'elite') return 0.25;
  if (tier === 'core' || tier === 'premium') return 0.1;
  return 0;
}

function applyTierEventMultiplier(baseEventMult, rawTier) {
  const base = Math.max(1, Number(baseEventMult) || 1);
  if (base < 2) return 1;
  const bonus = getTierEventBonusPct(rawTier);
  return Math.round(base * (1 + bonus) * 1000) / 1000;
}

function tierEventMultiplierLabel(baseEventMult, rawTier) {
  const mult = applyTierEventMultiplier(baseEventMult, rawTier);
  if (mult < 2) return null;
  const rounded = mult % 1 === 0 ? `${mult.toFixed(0)}` : mult.toFixed(2).replace(/\.?0+$/, '');
  return `${rounded}×`;
}

function describeTierEventBonus(rawTier) {
  const pct = getTierEventBonusPct(rawTier);
  if (!pct) return 'Standard event multipliers';
  const pctLabel = `${Math.round(pct * 100)}%`;
  return `+${pctLabel} bonus during Double Points and Triple Points events`;
}

module.exports = {
  DOUBLE_POINTS_BASE,
  TRIPLE_POINTS_BASE,
  getTierEventBonusPct,
  applyTierEventMultiplier,
  tierEventMultiplierLabel,
  describeTierEventBonus,
};
