/**
 * Perk Machine 2× Multiplier — server-side resolution only.
 */

const MULTIPLIER_TYPE = 'multiplier_2x';

const STACKABLE_TYPES = new Set([
  'savvy',
  'egg',
  'token',
  'streak_shield',
  'calling_card',
  'scout_flight_ticket',
]);

/**
 * @param {number} multiplierCount - number of 2× tiles in a spin (capped at 3 for 8×).
 */
function computeSpinMultiplier(multiplierCount) {
  const count = Math.max(0, Math.min(3, Number(multiplierCount) || 0));
  if (count === 0) {
    return { factor: 1, count: 0, isJackpot: false };
  }
  if (count >= 3) {
    return { factor: 8, count, isJackpot: true };
  }
  return { factor: 2 ** count, count, isJackpot: false };
}

function countMultiplierTiles(picks) {
  return (picks || []).filter((r) => r?.type === MULTIPLIER_TYPE).length;
}

/**
 * Scale a single reward definition before grant (multiplier tiles are never scaled).
 */
function scaleRewardForMultiplier(rewardDef, factor) {
  if (!rewardDef || factor <= 1 || rewardDef.type === MULTIPLIER_TYPE) {
    return { ...rewardDef };
  }

  const scaled = { ...rewardDef, spinMultiplier: factor };
  scaled.baseLabel = rewardDef.label;

  if (rewardDef.type === 'savvy') {
    const baseAmount = Number(rewardDef.amount) || 0;
    scaled.baseAmount = baseAmount;
    scaled.amount = baseAmount * factor;
    scaled.label = `+${scaled.amount} Savvy`;
    scaled.id = `${rewardDef.id}_x${factor}`;
  } else if (STACKABLE_TYPES.has(rewardDef.type)) {
    scaled.quantity = factor;
    if (factor > 1) {
      scaled.label = `${rewardDef.label} ×${factor}`;
    }
  } else if (rewardDef.type === 'supply_drop') {
    scaled.quantity = 1;
    if (factor > 1) {
      scaled.label = `${rewardDef.label} (bonus spin)`;
    }
  }

  return scaled;
}

function formatSavvyPart(amount) {
  return `+${Number(amount) || 0} Savvy`;
}

function formatSavvyExpr(amount) {
  return `${Number(amount) || 0} Savvy`;
}

/**
 * Human-readable breakdown for UI: "2× + 500 Savvy + Rare Egg = 1,000 Savvy + 2 Rare Eggs"
 */
function buildMultiplierBreakdown(rawPicks, factor) {
  if (factor <= 1 || !Array.isArray(rawPicks) || rawPicks.length === 0) {
    return null;
  }

  const multipliers = rawPicks.filter((r) => r.type === MULTIPLIER_TYPE);
  const others = rawPicks.filter((r) => r.type !== MULTIPLIER_TYPE);
  if (!multipliers.length || !others.length) {
    return {
      factor,
      count: multipliers.length,
      expression: multipliers.map(() => '2×').join(' + '),
      result: multipliers.length >= 3 ? '8× Jackpot multiplier!' : `${factor}× applied`,
      isJackpot: multipliers.length >= 3,
    };
  }

  const expressionLeft = [
    ...multipliers.map(() => '2×'),
    ...others.map((r) => (r.type === 'savvy' ? formatSavvyExpr(r.amount) : r.label)),
  ].join(' + ');

  const resultRight = others
    .map((r) => {
      const scaled = scaleRewardForMultiplier(r, factor);
      if (r.type === 'savvy') return formatSavvyPart(scaled.amount);
      return scaled.label || r.label;
    })
    .join(' + ');

  return {
    factor,
    count: multipliers.length,
    expression: `${expressionLeft} = ${resultRight}`,
    result: resultRight,
    isJackpot: multipliers.length >= 3,
  };
}

module.exports = {
  MULTIPLIER_TYPE,
  STACKABLE_TYPES,
  computeSpinMultiplier,
  countMultiplierTiles,
  scaleRewardForMultiplier,
  buildMultiplierBreakdown,
};
