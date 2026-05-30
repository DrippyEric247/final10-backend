const mongoose = require('mongoose');
const PremiumEntitlement = require('../models/PremiumEntitlement');
const User = require('../models/User');
const { monetizationFromEntitlement } = require('./creatorEliteAccessService');
const { isProduction } = require('../config/envValidation');
const { envFlag } = require('../config/envValidation');

/**
 * Whether subscription document grants in-app premium battle pass track access.
 */
function premiumStatusGrantsBattlePassAccess(doc) {
  if (!doc) return false;
  const s = doc.premiumStatus;
  return s === 'active' || s === 'trialing';
}

function mapStripeSubscriptionStatus(stripeStatus) {
  switch (String(stripeStatus || '').toLowerCase()) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'incomplete_expired':
    case 'incomplete':
      return 'expired';
    default:
      return 'inactive';
  }
}

function toUserObjectId(userId) {
  if (!userId) return null;
  if (userId instanceof mongoose.Types.ObjectId) return userId;
  const s = String(userId);
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

const { isBetaTester: checkBetaTester, logBetaUsage } = require('../services/betaTesterService');

function hasFoundingTesterAccess(user) {
  return checkBetaTester(user);
}

async function getEntitlementByUserId(userId) {
  const uid = toUserObjectId(userId);
  if (!uid) return null;
  return PremiumEntitlement.findOne({ userId: uid }).lean();
}

async function ensureEntitlementRow(userId) {
  const uid = toUserObjectId(userId);
  if (!uid) return null;
  let row = await PremiumEntitlement.findOne({ userId: uid });
  if (!row) {
    row = await PremiumEntitlement.create({
      userId: uid,
      premiumStatus: 'inactive',
      premiumTier: 'free',
      provider: 'stripe',
    });
  }
  return row;
}

/**
 * Public payload for GET /api/entitlements/me
 */
function toMeResponse(doc, user = null) {
  const foundingTesterAccess = hasFoundingTesterAccess(user);
  if (foundingTesterAccess) {
    return {
      isPremium: true,
      premiumStatus: 'active',
      premiumTier: 'elite',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      provider: 'beta',
      creatorMonetization: monetizationFromEntitlement(doc),
      foundingTesterAccess: true,
      isBetaTester: true,
      betaTester: Boolean(user?.betaTester),
      foundingAccess: Boolean(user?.foundingAccess),
      betaAccessExpiresAt: user?.betaAccessExpiresAt || null,
    };
  }
  if (!doc) {
    return {
      isPremium: false,
      premiumStatus: 'inactive',
      premiumTier: 'free',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      provider: 'stripe',
      creatorMonetization: monetizationFromEntitlement(null),
      foundingTesterAccess: false,
      isBetaTester: false,
      betaTester: Boolean(user?.betaTester),
      foundingAccess: Boolean(user?.foundingAccess),
      betaAccessExpiresAt: user?.betaAccessExpiresAt || null,
    };
  }
  const isPremium = premiumStatusGrantsBattlePassAccess(doc);
  return {
    isPremium,
    premiumStatus: doc.premiumStatus,
    premiumTier: doc.premiumTier || 'free',
    currentPeriodEnd: doc.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(doc.cancelAtPeriodEnd),
    trialEndsAt: doc.trialEndsAt || null,
    provider: doc.provider || 'stripe',
    creatorMonetization: monetizationFromEntitlement(doc),
    foundingTesterAccess: false,
    isBetaTester: false,
    betaTester: Boolean(user?.betaTester),
    foundingAccess: Boolean(user?.foundingAccess),
    betaAccessExpiresAt: user?.betaAccessExpiresAt || null,
  };
}

/**
 * Apply Stripe subscription object onto PremiumEntitlement (webhook truth).
 */
async function upsertFromStripeSubscription(userId, subscription, customerId) {
  const uid = toUserObjectId(userId);
  if (!uid) throw new Error('Invalid userId for entitlement upsert');
  const sub = subscription || {};
  const status = mapStripeSubscriptionStatus(sub.status);
  const metaTier = String(sub.metadata?.premiumTier || sub.metadata?.tier || '').toLowerCase();
  let tier = 'premium';
  if (metaTier === 'elite') tier = 'elite';
  else if (metaTier === 'vip') tier = 'vip';
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const cps = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
  const cpe = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

  const doc = await PremiumEntitlement.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        premiumStatus: status,
        premiumTier: premiumStatusGrantsBattlePassAccess({ premiumStatus: status }) ? tier : 'free',
        provider: 'stripe',
        providerCustomerId: customerId || undefined,
        providerSubscriptionId: sub.id || null,
        currentPeriodStart: cps,
        currentPeriodEnd: cpe,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        trialEndsAt: trialEnd,
        lastVerifiedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

/**
 * Mark payment failed / subscription ended (webhook).
 */
async function markEntitlementStatus(userId, premiumStatus, extra = {}) {
  const uid = toUserObjectId(userId);
  if (!uid) return null;
  const tier =
    premiumStatus === 'active' || premiumStatus === 'trialing' ? 'premium' : 'free';
  return PremiumEntitlement.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        premiumStatus,
        premiumTier: tier,
        lastVerifiedAt: new Date(),
        ...extra,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * Legacy + entitlement: used only where we still need a synchronous check without DB roundtrip.
 * Prefer loading PremiumEntitlement in production.
 */
function canSelfServeBattlePassPremiumUnlock(user, entitlementLean) {
  if (!user) return { ok: false, reason: 'no_user' };
  if (hasFoundingTesterAccess(user)) {
    return { ok: true, reason: 'founding_tester_access' };
  }
  if (!isProduction()) {
    return { ok: true, reason: 'non_production' };
  }
  if (envFlag('ALLOW_BP_CLIENT_PREMIUM_UNLOCK')) {
    return { ok: true, reason: 'env_override' };
  }
  if (premiumStatusGrantsBattlePassAccess(entitlementLean)) {
    return { ok: true, reason: 'entitlement_subscription' };
  }
  if (user.membershipTier === 'premium' || user.membershipTier === 'pro') {
    return { ok: true, reason: 'membership_tier' };
  }
  if (user.isPremium) {
    return { ok: true, reason: 'is_premium' };
  }
  if (user.subscriptionExpires && new Date(user.subscriptionExpires) > new Date()) {
    return { ok: true, reason: 'active_subscription' };
  }
  return { ok: false, reason: 'no_entitlement' };
}

async function assertPremiumRewardAllowed(userId) {
  const ent = await getEntitlementByUserId(userId);
  if (premiumStatusGrantsBattlePassAccess(ent)) {
    return { ok: true, entitlement: ent };
  }
  const user = await User.findById(userId).lean();
  const gate = canSelfServeBattlePassPremiumUnlock(user, ent);
  if (gate.ok) return { ok: true, entitlement: ent };
  const err = new Error('Active premium subscription required');
  err.status = 403;
  err.code = 'PREMIUM_REQUIRED';
  throw err;
}

module.exports = {
  PremiumEntitlement,
  toUserObjectId,
  premiumStatusGrantsBattlePassAccess,
  mapStripeSubscriptionStatus,
  getEntitlementByUserId,
  ensureEntitlementRow,
  toMeResponse,
  upsertFromStripeSubscription,
  markEntitlementStatus,
  canSelfServeBattlePassPremiumUnlock,
  assertPremiumRewardAllowed,
  isBetaTester: checkBetaTester,
  hasFoundingTesterAccess,
};
