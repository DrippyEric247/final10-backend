/**
 * Savvy Sale — global timed Perk Machine discount event.
 */

const crypto = require('crypto');
const LiveEvent = require('../models/LiveEvent');
const { SAVVY_SALE_DISCOUNT_PERCENT, applySavvySaleDiscountPercent } = require('../config/savvySaleConfig');

class SavvySaleError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function expireStaleSales() {
  await LiveEvent.updateMany(
    { type: 'SAVVY_SALE', active: true, expiresAt: { $lte: new Date() } },
    { $set: { active: false } }
  );
}

function serializeSavvySale(event) {
  if (!event) return null;
  const msLeft = Math.max(0, new Date(event.expiresAt).getTime() - Date.now());
  const live = validateActiveSavvySale({ ...event, active: event.active });
  return {
    eventId: event.eventId,
    type: event.type,
    active: live,
    startAt: event.startAt,
    expiresAt: event.expiresAt,
    msRemaining: live ? msLeft : 0,
    saleDiscountPercent: SAVVY_SALE_DISCOUNT_PERCENT,
    /** @deprecated Use saleDiscountPercent — kept for legacy clients. */
    saleSpinCost: applySavvySaleDiscountPercent(20),
    source: event.source,
  };
}

async function getActiveSavvySale() {
  await expireStaleSales();
  const event = await LiveEvent.findOne({
    type: 'SAVVY_SALE',
    active: true,
    expiresAt: { $gt: new Date() },
  })
    .sort({ startAt: -1 })
    .lean();
  return serializeSavvySale(event);
}

function isSavvySaleActive(sale) {
  if (!sale) return false;
  return validateActiveSavvySale(sale);
}

/**
 * Server-clock validation — client timestamps cannot extend or spoof sale windows.
 */
function validateActiveSavvySale(sale) {
  if (!sale || sale.active !== true) return false;
  const now = Date.now();
  const startAt = new Date(sale.startAt).getTime();
  const expiresAt = new Date(sale.expiresAt).getTime();
  if (Number.isNaN(startAt) || Number.isNaN(expiresAt)) return false;
  return startAt <= now && expiresAt > now;
}

async function startSavvySale({
  durationMinutes = 15,
  createdBy = null,
  source = 'admin',
  meta = {},
}) {
  await expireStaleSales();
  await LiveEvent.updateMany({ type: 'SAVVY_SALE', active: true }, { $set: { active: false } });

  const minutes = Math.max(1, Math.min(120, Math.round(Number(durationMinutes) || 15)));
  const startAt = new Date();
  const expiresAt = new Date(startAt.getTime() + minutes * 60 * 1000);
  const eventId = crypto.randomUUID();

  const event = await LiveEvent.create({
    eventId,
    type: 'SAVVY_SALE',
    startAt,
    expiresAt,
    active: true,
    createdBy,
    source,
    meta,
  });

  return serializeSavvySale(event);
}

async function endSavvySale() {
  const result = await LiveEvent.updateMany(
    { type: 'SAVVY_SALE', active: true },
    { $set: { active: false } }
  );
  return { endedCount: result.modifiedCount || 0, active: null };
}

function applySavvySaleToSpinCost(baseCost, saleActive) {
  if (!saleActive) {
    return resolveSavvySaleSpinPricing(baseCost, null);
  }
  const now = Date.now();
  return resolveSavvySaleSpinPricing(baseCost, {
    active: true,
    startAt: new Date(now - 60_000),
    expiresAt: new Date(now + 60_000),
    eventId: 'legacy-boolean-sale',
  });
}

/**
 * Resolve Perk Machine spin cost with at most one sale discount (no stacking).
 * Paid spin tokens and other discounts must zero sale separately in perkMachineService.
 */
function resolveSavvySaleSpinPricing(baseCost, saleEvent) {
  const originalCost = Math.max(0, Math.round(Number(baseCost) || 0));
  const saleLive = saleEvent === true ? true : validateActiveSavvySale(saleEvent);

  if (!saleLive || originalCost <= 0) {
    return {
      cost: originalCost,
      originalCost,
      saleApplied: false,
      savings: 0,
      saleEventId: null,
    };
  }

  const cost = applySavvySaleDiscountPercent(originalCost);
  return {
    cost,
    originalCost,
    saleApplied: true,
    savings: Math.max(0, originalCost - cost),
    saleEventId: saleEvent?.eventId || null,
    discountPercent: SAVVY_SALE_DISCOUNT_PERCENT,
  };
}

module.exports = {
  SavvySaleError,
  getActiveSavvySale,
  isSavvySaleActive,
  validateActiveSavvySale,
  startSavvySale,
  endSavvySale,
  applySavvySaleToSpinCost,
  resolveSavvySaleSpinPricing,
  serializeSavvySale,
  SAVVY_SALE_DISCOUNT_PERCENT,
  applySavvySaleDiscountPercent,
  /** @deprecated */
  SAVVY_SALE_SPIN_COST: applySavvySaleDiscountPercent(20),
};
