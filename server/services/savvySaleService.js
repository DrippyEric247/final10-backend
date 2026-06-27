/**
 * Savvy Sale — global timed Perk Machine discount event.
 */

const crypto = require('crypto');
const LiveEvent = require('../models/LiveEvent');
const { SAVVY_SALE_SPIN_COST } = require('../config/savvySaleConfig');

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
  return {
    eventId: event.eventId,
    type: event.type,
    active: event.active && msLeft > 0,
    startAt: event.startAt,
    expiresAt: event.expiresAt,
    msRemaining: msLeft,
    saleSpinCost: SAVVY_SALE_SPIN_COST,
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
  return sale.active && sale.msRemaining > 0;
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
  if (!saleActive || baseCost <= 0) {
    return { cost: baseCost, originalCost: baseCost, saleApplied: false, savings: 0 };
  }
  return {
    cost: SAVVY_SALE_SPIN_COST,
    originalCost: baseCost,
    saleApplied: true,
    savings: Math.max(0, baseCost - SAVVY_SALE_SPIN_COST),
  };
}

module.exports = {
  SavvySaleError,
  getActiveSavvySale,
  isSavvySaleActive,
  startSavvySale,
  endSavvySale,
  applySavvySaleToSpinCost,
  serializeSavvySale,
  SAVVY_SALE_SPIN_COST,
};
