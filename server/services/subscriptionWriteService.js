/**
 * Canonical subscription / grant write service (Wave 2 closure).
 *
 * All new production subscription writes go through here.
 * Legacy User fields are populated once for read compatibility.
 * Paid truth is stored in PremiumEntitlement.
 */

const User = require('../models/User');
const { PLAN, normalizeCanonicalPlan, planToSubscriptionTierId } = require('../config/canonicalPlans');
const {
  syncEntitlementFromOwnerMembership,
  ensureEntitlementRow,
  toUserObjectId,
  premiumStatusGrantsBattlePassAccess,
} = require('./premiumEntitlementService');
const PremiumEntitlement = require('../models/PremiumEntitlement');
const { buildOwnerMembershipMongoSet } = require('../lib/membershipFields');

function canonicalPlanToPremiumEntitlementTier(plan) {
  const p = normalizeCanonicalPlan(plan);
  if (p === PLAN.PRO) return 'elite';
  if (p === PLAN.PREMIUM) return 'premium';
  return 'free';
}

function buildLegacyUserCompatSet(plan, options = {}) {
  const canonical = normalizeCanonicalPlan(plan);
  const subTierId = planToSubscriptionTierId(canonical);
  const isPaid = canonical !== PLAN.FREE;
  const {
    expiresAt = null,
    billing = null,
    multiplier = null,
    badge = null,
    isLifetime = false,
    subscriptionTierOverride = null,
    subscriptionObject = null,
  } = options;

  const $set = {
    membershipTier: canonical,
    premiumTier: canonical,
    isPremium: isPaid,
    premium: isPaid,
    tier: canonical,
    plan: canonical,
    subscriptionTier: subscriptionTierOverride || (subTierId === 'core' ? 'core' : subTierId === 'pro' ? 'pro' : 'free'),
    'subscription.tier': subTierId,
    subscriptionExpires: isLifetime ? null : expiresAt,
    membershipExpiresAt: isLifetime ? null : expiresAt,
  };

  if (subscriptionObject && typeof subscriptionObject === 'object') {
    $set.subscription = subscriptionObject;
  } else if (billing || multiplier != null || expiresAt || badge) {
    if (billing) $set['subscription.billing'] = billing;
    if (multiplier != null) $set['subscription.multiplier'] = multiplier;
    if (expiresAt) $set['subscription.renewalDate'] = expiresAt;
    if (badge != null) $set['subscription.badge'] = badge;
  }

  if (canonical === PLAN.FREE) {
    $set.isPremium = false;
    $set.premium = false;
    $set.subscriptionExpires = null;
    $set.membershipExpiresAt = null;
    $set['subscription.renewalDate'] = null;
    $set['subscription.badge'] = '';
  }

  return $set;
}

async function applyPremiumEntitlementPaidPlan(userId, plan, options = {}) {
  const uid = toUserObjectId(userId);
  if (!uid) throw new Error('Invalid userId for paid entitlement apply');

  const canonical = normalizeCanonicalPlan(plan);
  const isPaid = canonical !== PLAN.FREE;
  const premiumTier = canonicalPlanToPremiumEntitlementTier(canonical);
  const premiumStatus = isPaid ? 'active' : 'inactive';

  await ensureEntitlementRow(uid);
  const doc = await PremiumEntitlement.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        premiumStatus,
        premiumTier: isPaid ? premiumTier : 'free',
        currentPeriodEnd: isPaid ? options.expiresAt || null : null,
        cancelAtPeriodEnd: false,
        lastVerifiedAt: new Date(),
        provider: options.provider || 'stripe',
        ...(options.providerSubscriptionId
          ? { providerSubscriptionId: options.providerSubscriptionId }
          : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

/**
 * Verified paid subscription activation (legacy payment-intent, dev subscribe, etc.).
 */
async function applyVerifiedPaidSubscription(userId, { plan, expiresAt, provider = 'stripe', subscriptionObject = null, extraUserSet = {} }) {
  const canonical = normalizeCanonicalPlan(plan);
  if (canonical === PLAN.FREE) {
    throw new Error('applyVerifiedPaidSubscription requires a paid plan');
  }

  await applyPremiumEntitlementPaidPlan(userId, canonical, {
    expiresAt,
    provider,
    providerSubscriptionId: extraUserSet.providerSubscriptionId,
  });

  const $set = {
    ...buildLegacyUserCompatSet(canonical, {
      expiresAt,
      subscriptionObject,
      billing: subscriptionObject?.billing,
      multiplier: subscriptionObject?.multiplier,
      badge: subscriptionObject?.badge,
    }),
    ...extraUserSet,
  };

  const user = await User.findByIdAndUpdate(userId, { $set }, { new: true });
  return user;
}

async function revokePaidSubscription(userId, { provider = 'stripe' } = {}) {
  const uid = toUserObjectId(userId);
  if (!uid) throw new Error('Invalid userId for revoke');

  await PremiumEntitlement.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        premiumStatus: 'inactive',
        premiumTier: 'free',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        lastVerifiedAt: new Date(),
        provider,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const $set = buildLegacyUserCompatSet(PLAN.FREE);
  return User.findByIdAndUpdate(userId, { $set }, { new: true });
}

async function applyOwnerMembershipGrant(userId, membershipTier, durationMonths, extraSet = {}) {
  const { $set } = buildOwnerMembershipMongoSet(membershipTier, durationMonths);
  const user = await User.findByIdAndUpdate(userId, { $set: { ...$set, ...extraSet } }, { new: true });
  if (user) {
    await syncEntitlementFromOwnerMembership(userId, user);
  }
  return user;
}

/**
 * Temporary Pro grant (Founding Tester grand reward) — does not overwrite PremiumEntitlement paid state.
 */
async function applyTemporaryProGrant(user, { expiresAt, source = 'founding_tester' }) {
  if (!user) return null;
  const currentEnd = user.subscriptionExpires ? new Date(user.subscriptionExpires) : null;
  const grantEnd = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const hasBetterPaidPro =
    normalizeCanonicalPlan(user.membershipTier) === PLAN.PRO && currentEnd && currentEnd > grantEnd;

  if (hasBetterPaidPro) {
    return user;
  }

  user.membershipTier = 'pro';
  user.premiumTier = 'pro';
  user.isPremium = true;
  user.premium = true;
  user.subscriptionExpires = grantEnd;
  user.subscriptionTier = 'pro';
  user.tier = 'pro';
  user.plan = 'pro';
  if (!user.subscription || typeof user.subscription !== 'object') user.subscription = {};
  user.subscription.tier = 'pro';
  user.subscription.renewalDate = grantEnd;
  user.subscription.badge = 'PRO';
  user.markModified('subscription');

  await user.save();
  return user;
}

/**
 * Welcome promo 7-day premium — temporary grant stored on User for resolver.
 */
async function applyWelcomePromoGrant(userId, expiresAt) {
  const $set = buildLegacyUserCompatSet(PLAN.PREMIUM, { expiresAt });
  $set.referralCodeUsed = 'welcome';
  return User.findByIdAndUpdate(userId, { $set }, { new: true });
}

function entitlementDocToCanonicalPlan(entitlementDoc) {
  if (!entitlementDoc || !premiumStatusGrantsBattlePassAccess(entitlementDoc)) {
    return PLAN.FREE;
  }
  const tier = String(entitlementDoc.premiumTier || '').toLowerCase();
  if (tier === 'elite' || tier === 'vip') return PLAN.PRO;
  if (tier === 'premium') return PLAN.PREMIUM;
  return PLAN.PREMIUM;
}

/**
 * Mirror PremiumEntitlement onto legacy User compat fields (Wave 6).
 * Called after Stripe webhook writes so resolver + legacy readers stay aligned.
 */
async function syncLegacyUserFieldsFromEntitlement(userId, entitlementDoc) {
  const plan = entitlementDocToCanonicalPlan(entitlementDoc);
  const $set = buildLegacyUserCompatSet(plan, {
    expiresAt: entitlementDoc?.currentPeriodEnd || null,
    isLifetime: plan !== PLAN.FREE && !entitlementDoc?.currentPeriodEnd,
  });
  return User.findByIdAndUpdate(userId, { $set }, { new: true });
}

/**
 * Owner lifetime Pro grant — writes PE + legacy compat in one path.
 */
async function applyLifetimeMembershipGrant(userId, plan = PLAN.PRO, extraSet = {}) {
  const canonical = normalizeCanonicalPlan(plan);
  await applyPremiumEntitlementPaidPlan(userId, canonical, {
    expiresAt: null,
    provider: 'owner',
  });
  const $set = {
    ...buildLegacyUserCompatSet(canonical, { isLifetime: true }),
    ...extraSet,
  };
  const user = await User.findByIdAndUpdate(userId, { $set }, { new: true });
  if (user) {
    await syncEntitlementFromOwnerMembership(userId, user);
  }
  return user;
}

/**
 * Extend paid membership by N months (community rewards, promos).
 */
async function extendMembershipMonths(userId, months, plan = PLAN.PREMIUM, extraSet = {}) {
  const canonical = normalizeCanonicalPlan(plan);
  const user = await User.findById(userId);
  if (!user) return null;

  const now = new Date();
  const base =
    user.subscriptionExpires && new Date(user.subscriptionExpires) > now
      ? new Date(user.subscriptionExpires)
      : now;
  const expires = new Date(base);
  expires.setMonth(expires.getMonth() + Math.max(1, Number(months) || 1));

  await applyPremiumEntitlementPaidPlan(userId, canonical, {
    expiresAt: expires,
    provider: 'promo',
  });

  const $set = {
    ...buildLegacyUserCompatSet(canonical, { expiresAt: expires }),
    subscriptionEnd: expires,
    ...extraSet,
  };
  return User.findByIdAndUpdate(userId, { $set }, { new: true });
}

function isPaidEntitlementActive(entitlementDoc) {
  return premiumStatusGrantsBattlePassAccess(entitlementDoc);
}

module.exports = {
  buildLegacyUserCompatSet,
  applyVerifiedPaidSubscription,
  revokePaidSubscription,
  applyOwnerMembershipGrant,
  applyTemporaryProGrant,
  applyWelcomePromoGrant,
  applyPremiumEntitlementPaidPlan,
  applyLifetimeMembershipGrant,
  extendMembershipMonths,
  syncLegacyUserFieldsFromEntitlement,
  entitlementDocToCanonicalPlan,
  isPaidEntitlementActive,
  canonicalPlanToPremiumEntitlementTier,
};
