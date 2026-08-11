/**
 * Savvy earnings multiplier — centralized economy configuration.
 *
 * Stacking model:
 *   coreMultiplier = min(CORE_CAP, power + Σ additive bonuses)
 *   effectiveMultiplier = coreMultiplier × specialCombined
 *
 * Additive bonuses use existing product values converted to +Δ above 1.0×
 * (subscription tier multipliers 1.15 / 1.35 become +0.15 / +0.35).
 */

const HOUR = 60 * 60 * 1000;

/** Cap on ordinary/core multiplier BEFORE global events (Double/Triple, etc.). */
const CORE_MULTIPLIER_CAP = Number(process.env.SAVVY_CORE_MULTIPLIER_CAP) || 3.0;

/** Minimum power multiplier floor for earnings. */
const POWER_EARNINGS_FLOOR = 1.0;

/** Mythic timed Savvy earnings boost (product spec: 3× for 5 hours). */
const MYTHIC_SAVVY_MULTIPLIER = Number(process.env.SAVVY_MYTHIC_EARNINGS_MULTIPLIER) || 3;
const MYTHIC_SAVVY_DURATION_MS =
  Number(process.env.SAVVY_MYTHIC_EARNINGS_DURATION_MS) || 5 * HOUR;

/**
 * When Mythic 3× and Double/Triple Points overlap:
 * - `max_multiplier`: core × max(mythic, event) — prevents exponential blow-up
 * - `multiply_all`: core × mythic × event (legacy/experimental; not default)
 */
const MYTHIC_EVENT_STACKING_POLICY =
  process.env.SAVVY_MYTHIC_EVENT_STACKING || 'max_multiplier';

/**
 * Ecosystem additive bonuses — mirrors client mockSavvyDealRewards.ts multipliers
 * converted to +Δ: 1.12→+0.12, 1.35→+0.35, 2.0→+1.0
 */
const ECOSYSTEM_ADDITIVE_BY_CONNECTED_APPS = Object.freeze({
  0: 0,
  1: 0.12,
  2: 0.35,
  3: 1.0,
});

/** Yearly billing bonus — subscriptionPlans.YEARLY_BONUS.multiplierBoost */
const YEARLY_SUBSCRIPTION_ADDITIVE_BONUS = 0.1;

/**
 * Deal streak additive bonuses (new — no prior Savvy mult existed).
 * Highest matching tier wins (not stacked).
 */
const DEAL_STREAK_ADDITIVE_TIERS = Object.freeze([
  { minStreak: 10, amount: 0.15, label: 'Deal Streak' },
  { minStreak: 5, amount: 0.1, label: 'Deal Streak' },
  { minStreak: 3, amount: 0.05, label: 'Deal Streak' },
]);

/** Rounding: final Savvy grants use integer Math.round. */
const ROUND_SAVVY_REWARD = (n) => Math.max(0, Math.round(Number(n) || 0));

/** Round multiplier display/calculation to 3 decimals. */
const ROUND_MULTIPLIER = (n) => Math.round(Math.max(0, Number(n) || 0) * 1000) / 1000;

function ecosystemAdditiveBonus(connectedCount) {
  const n = Math.max(0, Math.min(3, Math.round(Number(connectedCount) || 0)));
  return ECOSYSTEM_ADDITIVE_BY_CONNECTED_APPS[n] ?? 0;
}

function dealStreakAdditiveBonus(currentStreak) {
  const streak = Math.max(0, Math.round(Number(currentStreak) || 0));
  for (const tier of DEAL_STREAK_ADDITIVE_TIERS) {
    if (streak >= tier.minStreak) {
      return { amount: tier.amount, label: tier.label, minStreak: tier.minStreak };
    }
  }
  return { amount: 0, label: 'Deal Streak', minStreak: 0 };
}

module.exports = {
  CORE_MULTIPLIER_CAP,
  POWER_EARNINGS_FLOOR,
  MYTHIC_SAVVY_MULTIPLIER,
  MYTHIC_SAVVY_DURATION_MS,
  MYTHIC_EVENT_STACKING_POLICY,
  ECOSYSTEM_ADDITIVE_BY_CONNECTED_APPS,
  YEARLY_SUBSCRIPTION_ADDITIVE_BONUS,
  DEAL_STREAK_ADDITIVE_TIERS,
  ROUND_SAVVY_REWARD,
  ROUND_MULTIPLIER,
  ecosystemAdditiveBonus,
  dealStreakAdditiveBonus,
};
