/**
 * Perk Machine Spin Heat — anti-abuse pricing tiers.
 */

/** Multiplier ladder applied to base spin costs (never exceeds last value). */
const SPIN_HEAT_MULTIPLIERS = Object.freeze([1, 2, 4, 6, 8, 10]);

const SPIN_HEAT_MAX = 10;

/** Cooldown after first reaching max heat — then pricing resets to 1x. */
const SPIN_HEAT_COOLDOWN_MS = 60 * 60 * 1000;

const SPIN_HEAT_BASE_COSTS = Object.freeze({
  paid_1: 20,
  paid_2: 40,
  paid_3: 60,
});

function getSpinHeatMultiplierForTierIndex(tierIndex) {
  const idx = Math.min(SPIN_HEAT_MULTIPLIERS.length - 1, Math.max(0, Number(tierIndex) || 0));
  return SPIN_HEAT_MULTIPLIERS[idx];
}

function applySpinHeatToBaseCost(baseSavvy, multiplier) {
  return Math.max(0, Math.round(Number(baseSavvy) * Number(multiplier)));
}

function getHeatAdjustedSpinCosts(multiplier) {
  return {
    paid_1: applySpinHeatToBaseCost(SPIN_HEAT_BASE_COSTS.paid_1, multiplier),
    paid_2: applySpinHeatToBaseCost(SPIN_HEAT_BASE_COSTS.paid_2, multiplier),
    paid_3: applySpinHeatToBaseCost(SPIN_HEAT_BASE_COSTS.paid_3, multiplier),
  };
}

module.exports = {
  SPIN_HEAT_MULTIPLIERS,
  SPIN_HEAT_MAX,
  SPIN_HEAT_COOLDOWN_MS,
  SPIN_HEAT_BASE_COSTS,
  getSpinHeatMultiplierForTierIndex,
  applySpinHeatToBaseCost,
  getHeatAdjustedSpinCosts,
};
