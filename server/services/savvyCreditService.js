/**
 * Server-authoritative Savvy credit wallet (discount credits + premium days).
 */

const { debitSavvy } = require('./savvyBalanceService');
const { SAVVY_POINTS_PER_DOLLAR, findStoreItem } = require('../config/savvyStoreItems');

function ensureSavvyCredits(user) {
  if (!user.savvyCredits || typeof user.savvyCredits !== 'object') {
    user.savvyCredits = { creditCents: 0, premiumDays: 0 };
  }
  if (typeof user.savvyCredits.creditCents !== 'number') user.savvyCredits.creditCents = 0;
  if (typeof user.savvyCredits.premiumDays !== 'number') user.savvyCredits.premiumDays = 0;
  return user.savvyCredits;
}

function serializeCreditState(user) {
  const sc = ensureSavvyCredits(user);
  return {
    creditCents: Math.max(0, Math.round(Number(sc.creditCents) || 0)),
    premiumDays: Math.max(0, Math.round(Number(sc.premiumDays) || 0)),
  };
}

/**
 * Convert Savvy points → discount credit cents (100 Savvy = $1).
 */
async function convertSavvyToCredits(user, { points, idempotencyKey }) {
  const pts = Math.max(0, Math.round(Number(points) || 0));
  const key = String(idempotencyKey || '').trim();
  if (!key) {
    const err = new Error('idempotencyKey is required');
    err.status = 400;
    err.code = 'IDEMPOTENCY_REQUIRED';
    throw err;
  }
  if (pts < 1) {
    const err = new Error('Enter a positive Savvy amount.');
    err.status = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  const balance = Math.round(Number(user.savvyPoints) || 0);
  if (pts > balance) {
    const err = new Error('Not enough Savvy points.');
    err.status = 400;
    err.code = 'INSUFFICIENT_SAVVY';
    throw err;
  }

  const addedCents = Math.round((pts / SAVVY_POINTS_PER_DOLLAR) * 100);
  const spend = await debitSavvy(user, {
    amount: pts,
    source: 'savvy_credit_convert',
    idempotencyKey: `credit_convert:${key}`,
    meta: { creditCents: addedCents },
  });

  if (!spend.granted && !spend.duplicate) {
    const err = new Error('Could not convert Savvy.');
    err.status = 400;
    err.code = 'DEBIT_FAILED';
    throw err;
  }

  if (!spend.duplicate) {
    const sc = ensureSavvyCredits(user);
    sc.creditCents = Math.max(0, Math.round(Number(sc.creditCents) || 0)) + addedCents;
    user.markModified('savvyCredits');
  }

  return {
    ok: true,
    duplicate: Boolean(spend.duplicate),
    pointsConverted: pts,
    creditCentsAdded: addedCents,
    newBalance: spend.newBalance,
    creditState: serializeCreditState(user),
  };
}

/**
 * Spend Savvy on a store catalog item.
 */
async function redeemSavvyStoreItem(user, { itemId, idempotencyKey }) {
  const item = findStoreItem(itemId);
  const key = String(idempotencyKey || '').trim();
  if (!item) {
    const err = new Error('Item unavailable.');
    err.status = 400;
    err.code = 'INVALID_ITEM';
    throw err;
  }
  if (!key) {
    const err = new Error('idempotencyKey is required');
    err.status = 400;
    err.code = 'IDEMPOTENCY_REQUIRED';
    throw err;
  }

  const balance = Math.round(Number(user.savvyPoints) || 0);
  if (item.costSavvy > balance) {
    const err = new Error('Not enough Savvy points.');
    err.status = 400;
    err.code = 'INSUFFICIENT_SAVVY';
    throw err;
  }

  const spend = await debitSavvy(user, {
    amount: item.costSavvy,
    source: 'savvy_store_redeem',
    idempotencyKey: `store_redeem:${key}`,
    meta: { itemId: item.id, itemLabel: item.label },
  });

  if (!spend.granted && !spend.duplicate) {
    const err = new Error('Could not redeem item.');
    err.status = 400;
    err.code = 'DEBIT_FAILED';
    throw err;
  }

  if (!spend.duplicate) {
    const sc = ensureSavvyCredits(user);
    sc.creditCents = Math.max(0, Math.round(Number(sc.creditCents) || 0)) + (item.creditCents || 0);
    sc.premiumDays = Math.max(0, Math.round(Number(sc.premiumDays) || 0)) + (item.premiumDays || 0);
    user.markModified('savvyCredits');
  }

  return {
    ok: true,
    duplicate: Boolean(spend.duplicate),
    item,
    newBalance: spend.newBalance,
    creditState: serializeCreditState(user),
  };
}

module.exports = {
  ensureSavvyCredits,
  serializeCreditState,
  convertSavvyToCredits,
  redeemSavvyStoreItem,
};
