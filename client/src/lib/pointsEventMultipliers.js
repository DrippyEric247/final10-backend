import { normalizeSubscriptionTier } from './tierMultiplier';

export const DOUBLE_POINTS_BASE = 2;
export const TRIPLE_POINTS_BASE = 3;

/** Premium (core): +10%. Pro / elite: +25%. */
export function getTierEventBonusPct(tier) {
  const t = normalizeSubscriptionTier(tier, tier !== 'free');
  if (t === 'pro' || t === 'elite') return 0.25;
  if (t === 'core' || t === 'premium') return 0.1;
  return 0;
}

export function applyTierEventMultiplier(baseEventMult, tier) {
  const base = Math.max(1, Number(baseEventMult) || 1);
  if (base < 2) return 1;
  const bonus = getTierEventBonusPct(tier);
  return Math.round(base * (1 + bonus) * 1000) / 1000;
}

export function tierEventMultiplierLabel(baseEventMult, tier) {
  const mult = applyTierEventMultiplier(baseEventMult, tier);
  if (mult < 2) return null;
  const text = Number.isInteger(mult) ? String(mult) : mult.toFixed(2).replace(/\.?0+$/, '');
  return `${text}×`;
}

export function describeTierEventBonus(tier) {
  const pct = getTierEventBonusPct(tier);
  if (!pct) return 'Standard event multipliers';
  return `+${Math.round(pct * 100)}% bonus during Double Points and Triple Points events`;
}
