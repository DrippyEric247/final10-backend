/**
 * Server-authoritative deal purchase reward estimates.
 * Savvy amounts and eligibility are never trusted from the client.
 */

const SavvyRewardLog = require('../models/SavvyRewardLog');
const DealRewardState = require('../models/DealRewardState');
const { applyTierEventMultiplier } = require('../lib/pointsEventMultipliers');
const { normalizeTier } = require('../config/subscriptionPlans');
const { getTierConfigForUser } = require('./betaTesterService');
const {
  isDoublePointsLive,
  isTriplePointsLive,
} = require('../services/eventActivationService');

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
  const tierCfg = getTierConfigForUser(user);
  return Math.max(1, Number(tierCfg?.multiplier) || 1);
}

function readActiveEventMultiplier(user) {
  const tier = normalizeTier(user?.subscription?.tier || user?.membershipTier || 'free');
  if (isTriplePointsLive()) {
    return {
      eventKey: 'triple_points',
      eventLabel: 'Triple Points',
      multiplier: applyTierEventMultiplier(3, tier),
    };
  }
  if (isDoublePointsLive()) {
    return {
      eventKey: 'double_points',
      eventLabel: 'Double Points',
      multiplier: applyTierEventMultiplier(2, tier),
    };
  }
  return { eventKey: null, eventLabel: null, multiplier: 1 };
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

  const userMult = readUserPowerMultiplier(user);
  const event = readActiveEventMultiplier(user);
  const preEventTotal = Math.round(baseSavvy * userMult);
  const eventBonus =
    event.multiplier > 1 ? Math.max(0, Math.round(preEventTotal * (event.multiplier - 1))) : 0;
  const totalSavvy = preEventTotal + eventBonus;

  let state = 'eligible';
  if (user?._id && listingId) {
    const tracked = await readRewardState(user._id, listingId);
    if (tracked === 'claimed') state = 'claimed';
    else if (tracked === 'pending') state = 'pending';
  }

  return {
    listingId,
    state,
    eligible: state !== 'not_eligible',
    trustTier: tier,
    baseSavvy,
    userMultiplier: userMult,
    preEventTotal,
    eventKey: event.eventKey,
    eventLabel: event.eventLabel,
    eventMultiplier: event.multiplier,
    eventBonus,
    totalSavvy,
    showEventBreakdown: event.multiplier > 1,
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

module.exports = {
  estimateDealReward,
  estimateDealRewardsBatch,
  markDealRewardClickout,
  getRewardTrustTier,
  deriveBaseSavvy,
};
