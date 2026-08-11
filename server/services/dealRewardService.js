/**
 * Server-authoritative deal purchase reward estimates.
 * Savvy amounts and eligibility are never trusted from the client.
 */

const SavvyRewardLog = require('../models/SavvyRewardLog');
const DealRewardState = require('../models/DealRewardState');
const {
  applySavvyMultiplier,
  clearExpiredSavvyBoosts,
  resolveSavvyMultiplierState,
} = require('./savvyMultiplierService');

const LOW_TRUST_THRESHOLD = 55;
const HIGH_TRUST_THRESHOLD = 80;

const TRUST_REWARD_MULTIPLIER = Object.freeze({
  high: 1.0,
  medium: 0.6,
  low: 0,
  unverified: 0,
});

function getRewardTrustTier(trustScore) {
  const score = Number(trustScore);
  if (!Number.isFinite(score)) return 'medium';
  if (score >= HIGH_TRUST_THRESHOLD) return 'high';
  if (score >= LOW_TRUST_THRESHOLD) return 'medium';
  if (score >= 36) return 'low';
  return 'unverified';
}

function deriveBaseSavvy(listing) {
  const provided = Number(listing.estimatedPointsEarned ?? listing.baseSavvy);
  if (Number.isFinite(provided) && provided > 0) return Math.round(provided);

  const savings = Number(listing.savings ?? listing.savingsAmount) || 0;
  const price =
    Number(listing.price ?? listing.buyNowPrice ?? listing.currentBidPrice ?? listing.feedPrice) || 0;
  const savingsPortion = savings > 0 ? savings * 0.8 : 0;
  const pricePortion = price > 0 ? price * 0.2 : 0;
  return Math.max(40, Math.round(savingsPortion + pricePortion));
}

function readUserPowerMultiplier(user) {
  return resolveSavvyMultiplierState(user).effectiveMultiplier;
}

function readActiveEventMultiplier(user) {
  const state = resolveSavvyMultiplierState(user);
  const global = state.specialMultipliers.find((s) => s.type === 'global_event');
  return {
    eventKey: global?.source || null,
    eventLabel: global?.label || null,
    multiplier: global?.multiplier || 1,
  };
}

async function readRewardState(userId, listingId) {
  const id = String(listingId || '').trim();
  if (!id) return 'not_eligible';

  const claimed = await SavvyRewardLog.findOne({
    userId,
    idempotencyKey: `deal_purchase:${userId}:${id}`,
  }).lean();
  if (claimed) return 'claimed';

  const pending = await DealRewardState.findOne({
    userId,
    listingId: id,
    status: 'pending',
  }).lean();
  if (pending) return 'pending';

  return null;
}

/**
 * Estimate purchase reward for one listing.
 * @returns {object|null} null when not eligible (hide badge)
 */
async function estimateDealReward(user, listing) {
  const listingId = String(listing.listingId ?? listing.itemId ?? listing.id ?? '').trim();
  const trustScore = Number(listing.trustScore) || 0;
  const tier = getRewardTrustTier(trustScore);
  const trustMult = TRUST_REWARD_MULTIPLIER[tier] ?? 0;

  if (trustMult <= 0) {
    return {
      listingId,
      state: 'not_eligible',
      eligible: false,
      trustTier: tier,
    };
  }

  clearExpiredSavvyBoosts(user);

  const baseRaw = deriveBaseSavvy(listing);
  const baseSavvy = Math.max(0, Math.round(baseRaw * trustMult));
  if (baseSavvy <= 0) {
    return {
      listingId,
      state: 'not_eligible',
      eligible: false,
      trustTier: tier,
    };
  }

  const payout = applySavvyMultiplier(baseSavvy, user);
  const multiplierState = payout.state;

  let state = 'eligible';
  if (user?._id && listingId) {
    const tracked = await readRewardState(user._id, listingId);
    if (tracked === 'claimed') state = 'claimed';
    else if (tracked === 'pending') state = 'pending';
  }

  const showEventBreakdown =
    multiplierState.specialMultipliers.length > 0 &&
    multiplierState.specialCombined > 1;

  return {
    listingId,
    state,
    eligible: state !== 'not_eligible',
    trustTier: tier,
    baseSavvy,
    userMultiplier: multiplierState.effectiveMultiplier,
    effectiveMultiplier: multiplierState.effectiveMultiplier,
    coreMultiplier: multiplierState.coreMultiplier,
    powerMultiplier: multiplierState.powerMultiplier,
    additiveBonuses: multiplierState.additiveBonuses,
    specialMultipliers: multiplierState.specialMultipliers,
    capApplied: multiplierState.capApplied,
    preEventTotal: payout.coreSavvy,
    coreSavvy: payout.coreSavvy,
    eventKey: multiplierState.eventKey,
    eventLabel: multiplierState.eventLabel,
    eventMultiplier: multiplierState.specialCombined,
    eventBonus: payout.specialBonusSavvy,
    specialBonusSavvy: payout.specialBonusSavvy,
    totalSavvy: payout.totalSavvy,
    multiplierComponents: multiplierState.additiveBonuses,
    showEventBreakdown,
  };
}

async function estimateDealRewardsBatch(user, listings = []) {
  const rows = Array.isArray(listings) ? listings.slice(0, 24) : [];
  const estimates = {};
  for (const listing of rows) {
    const est = await estimateDealReward(user, listing);
    const key = String(est.listingId || listing.listingId || listing.itemId || '').trim();
    if (key) estimates[key] = est;
  }
  return { estimates };
}

async function markDealRewardClickout(user, { listingId, listing = {} }) {
  const id = String(listingId || '').trim();
  if (!id) {
    const err = new Error('listingId is required');
    err.status = 400;
    throw err;
  }

  const estimate = await estimateDealReward(user, { ...listing, listingId: id });
  if (!estimate.eligible || estimate.state === 'not_eligible') {
    const err = new Error('Listing is not eligible for purchase rewards.');
    err.status = 400;
    err.code = 'NOT_ELIGIBLE';
    throw err;
  }
  if (estimate.state === 'claimed') {
    return { estimate, alreadyClaimed: true };
  }

  await DealRewardState.findOneAndUpdate(
    { userId: user._id, listingId: id },
    {
      userId: user._id,
      listingId: id,
      status: 'pending',
      baseSavvy: estimate.baseSavvy,
      eventBonus: estimate.eventBonus,
      totalSavvy: estimate.totalSavvy,
      meta: { eventKey: estimate.eventKey },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const { fireContractTrigger, isDeepDiscountListing } = require('./contractHooks');
  fireContractTrigger(user._id, 'deal_found');
  if (isDeepDiscountListing(listing)) {
    fireContractTrigger(user._id, 'deep_discount_deal');
  }

  return {
    estimate: { ...estimate, state: 'pending' },
    alreadyClaimed: false,
  };
}

/**
 * Confirm a verified deal purchase — grants Savvy idempotently and records qualifying deal.
 * Server-only; requires prior pending DealRewardState from clickout.
 */
async function confirmVerifiedDealPurchase(user, { listingId, listing = {} }) {
  const id = String(listingId || '').trim();
  if (!id) {
    const err = new Error('listingId is required');
    err.status = 400;
    throw err;
  }

  const pending = await DealRewardState.findOne({
    userId: user._id,
    listingId: id,
    status: 'pending',
  });
  if (!pending) {
    const err = new Error('No pending deal purchase to confirm.');
    err.status = 404;
    err.code = 'NOT_PENDING';
    throw err;
  }

  const estimate = await estimateDealReward(user, { ...listing, listingId: id });
  const idempotencyKey = `deal_purchase:${user._id}:${id}`;

  const existingLog = await SavvyRewardLog.findOne({ userId: user._id, idempotencyKey }).lean();
  if (existingLog) {
    pending.status = 'claimed';
    await pending.save();
    return { estimate, alreadyClaimed: true, granted: false };
  }

  const { grantSavvyReward } = require('./savvyRewardService');
  const grant = await grantSavvyReward(user, {
    rewardType: 'deal_purchase',
    amount: pending.totalSavvy || estimate.totalSavvy || 0,
    idempotencyKey,
    note: 'Verified deal purchase',
    meta: { listingId: id, source: 'deal_purchase_confirm' },
  });

  pending.status = 'claimed';
  await pending.save();
  await user.save();

  const categoryRaw =
    listing.category ||
    listing.categoryId ||
    listing.primaryCategory ||
    pending.meta?.category ||
    null;

  const { recordQualifyingDealFromPurchase } = require('./dealStreakHooks');
  recordQualifyingDealFromPurchase(user._id, {
    listingId: id,
    categoryRaw,
    meta: { listingId: id, savvyGranted: grant.amount },
  });

  return {
    estimate: { ...estimate, state: 'claimed' },
    granted: Boolean(grant.granted),
    duplicate: Boolean(grant.duplicate),
    amount: grant.amount,
    newBalance: grant.newBalance,
  };
}

module.exports = {
  estimateDealReward,
  estimateDealRewardsBatch,
  markDealRewardClickout,
  confirmVerifiedDealPurchase,
  getRewardTrustTier,
  deriveBaseSavvy,
};
