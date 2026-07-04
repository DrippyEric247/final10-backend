/**
 * Savvy Sale — limited-time Perk Machine pricing event.
 */

/** Percent off Savvy point redemptions during an active Savvy Sale. */
const SAVVY_SALE_DISCOUNT_PERCENT = 50;

const SAVVY_SALE_DURATIONS_MINUTES = Object.freeze([5, 10, 15, 30]);

const DEFAULT_SCOUT_SUPPORT_SALE_MINUTES = 15;

function applySavvySaleDiscountPercent(baseCost) {
  const original = Math.max(0, Math.round(Number(baseCost) || 0));
  if (original <= 0) return 0;
  const multiplier = (100 - SAVVY_SALE_DISCOUNT_PERCENT) / 100;
  return Math.max(0, Math.round(original * multiplier));
}

/** @deprecated Example 1-slot sale price — use applySavvySaleDiscountPercent instead. */
const SAVVY_SALE_SPIN_COST = applySavvySaleDiscountPercent(20);

module.exports = {
  SAVVY_SALE_DISCOUNT_PERCENT,
  SAVVY_SALE_SPIN_COST,
  SAVVY_SALE_DURATIONS_MINUTES,
  DEFAULT_SCOUT_SUPPORT_SALE_MINUTES,
  applySavvySaleDiscountPercent,
};
