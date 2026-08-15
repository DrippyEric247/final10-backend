/**
 * Wave 2 — Authoritative entitlement resolver for Final10.
 *
 * Separates stored base plan from effective access (beta, temporary grants, paid subs).
 * All feature limits and economy subscription bonuses should derive from here.
 */

const { getTierConfig } = require('../config/subscriptionPlans');
const { BETA_UNLIMITED } = require('../config/betaTester');
const {
  PLAN,
  normalizeCanonicalPlan,
  maxCanonicalPlan,
  planToSubscriptionTierId,
  planToClientDisplayTier,
  entitlementDocTierToPlan,
  planRank,
} = require('../config/canonicalPlans');
const { isBetaMode, hasBetaProAccess, getBetaModeAccessOverrides } = require('../config/betaMode');
const { normalizeMembershipTier } = require('../lib/membershipFields');

const ENTITLEMENT_SOURCES = Object.freeze({
  FREE: 'free',
  SUBSCRIPTION: 'subscription',
  BETA: 'beta',
  FOUNDING_TESTER: 'founding_tester',
  ADMIN: 'admin',
  PROMO: 'promo',
});

function premiumStatusGrantsBattlePassAccess(doc) {
  if (!doc) return false;
  const s = doc.premiumStatus;
  return s === 'active' || s === 'trialing';
}

function hasFoundingTesterAccess(user) {
  if (!user) return false;
  if (typeof user.hasFoundingTesterAccess === 'function') {
    return user.hasFoundingTesterAccess();
  }
  const flagged = Boolean(user.betaTester || user.foundingAccess);
  if (!flagged) return false;
  if (!user.betaAccessExpiresAt) return true;
  return new Date(user.betaAccessExpiresAt) > new Date();
}

function isFutureDate(value) {
  if (!value) return true;
  const d = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(d.getTime()) && d > new Date();
}

/**
 * Active user-stored membership (owner grants, legacy payments, welcome promo, founding grand reward).
 * Does not require isPremium when tier + expiry prove an active promo window.
 */
function isUserStoredMembershipActive(user) {
  if (!user) return false;
  const plan = normalizeCanonicalPlan(user.membershipTier || user.premiumTier);
  if (plan === PLAN.FREE) return false;
  if (!user.subscriptionExpires && !user.membershipExpiresAt) {
    return Boolean(user.isPremium || user.premium);
  }
  return isFutureDate(user.subscriptionExpires || user.membershipExpiresAt);
}

function isFoundingTesterGrandRewardMembership(user) {
  return (
    Boolean(user?.foundingTesterProgramCompleted) &&
    normalizeCanonicalPlan(user?.membershipTier) === PLAN.PRO &&
    Boolean(user?.subscriptionExpires)
  );
}

function isWelcomePromoMembership(user) {
  return (
    String(user?.referralCodeUsed || '').toLowerCase() === 'welcome' &&
    normalizeCanonicalPlan(user?.membershipTier) === PLAN.PREMIUM &&
    Boolean(user?.subscriptionExpires)
  );
}

function membershipExpiry(user) {
  return user?.subscriptionExpires || user?.membershipExpiresAt || null;
}

function resolveLegacyStoredTierCandidate(user) {
  if (isFoundingTesterGrandRewardMembership(user) || isWelcomePromoMembership(user)) {
    return null;
  }
  const legacyPlan = normalizeCanonicalPlan(
    user?.subscription?.tier || user?.membershipTier || user?.premiumTier
  );
  if (legacyPlan === PLAN.FREE) return null;
  return {
    plan: legacyPlan,
    source: ENTITLEMENT_SOURCES.SUBSCRIPTION,
    startsAt: null,
    expiresAt: membershipExpiry(user),
    priority: 85,
  };
}

function collectEntitlementCandidates(user, entitlementDoc = null) {
  const candidates = [];

  if (entitlementDoc && premiumStatusGrantsBattlePassAccess(entitlementDoc)) {
    candidates.push({
      plan: entitlementDocTierToPlan(entitlementDoc.premiumTier),
      source: ENTITLEMENT_SOURCES.SUBSCRIPTION,
      startsAt: entitlementDoc.currentPeriodStart || null,
      expiresAt: entitlementDoc.currentPeriodEnd || null,
      priority: 100,
    });
  }

  const legacyStored = resolveLegacyStoredTierCandidate(user);
  if (legacyStored) {
    candidates.push(legacyStored);
  }

  if (isUserStoredMembershipActive(user)) {
    const plan = normalizeCanonicalPlan(user.membershipTier || user.premiumTier);
    let source = ENTITLEMENT_SOURCES.PROMO;
    let priority = 40;

    if (isFoundingTesterGrandRewardMembership(user)) {
      source = ENTITLEMENT_SOURCES.FOUNDING_TESTER;
      priority = 60;
    } else if (isWelcomePromoMembership(user)) {
      source = ENTITLEMENT_SOURCES.PROMO;
      priority = 50;
    } else if (Boolean(user.isPremium || user.premium)) {
      source = ENTITLEMENT_SOURCES.ADMIN;
      priority = 90;
    }

    candidates.push({
      plan,
      source,
      startsAt: null,
      expiresAt: membershipExpiry(user),
      priority,
    });
  }

  if (hasFoundingTesterAccess(user) && !hasBetaProAccess(user)) {
    candidates.push({
      plan: PLAN.PRO,
      source: ENTITLEMENT_SOURCES.FOUNDING_TESTER,
      startsAt: null,
      expiresAt: user?.betaAccessExpiresAt || null,
      priority: 55,
    });
  }

  if (hasBetaProAccess(user)) {
    candidates.push({
      plan: PLAN.PRO,
      source: ENTITLEMENT_SOURCES.BETA,
      startsAt: null,
      expiresAt: null,
      priority: 70,
    });
  }

  return candidates.filter((c) => isFutureDate(c.expiresAt));
}

function pickWinningCandidate(candidates) {
  if (!candidates.length) {
    return {
      plan: PLAN.FREE,
      source: ENTITLEMENT_SOURCES.FREE,
      startsAt: null,
      expiresAt: null,
    };
  }

  let winner = candidates[0];
  for (let i = 1; i < candidates.length; i += 1) {
    const c = candidates[i];
    const rankDiff = planRank(c.plan) - planRank(winner.plan);
    if (rankDiff > 0) {
      winner = c;
      continue;
    }
    if (rankDiff === 0 && c.priority > winner.priority) {
      winner = c;
      continue;
    }
    if (rankDiff === 0 && c.priority === winner.priority) {
      const wExp = winner.expiresAt ? new Date(winner.expiresAt).getTime() : Infinity;
      const cExp = c.expiresAt ? new Date(c.expiresAt).getTime() : Infinity;
      if (cExp > wExp) winner = c;
    }
  }
  return winner;
}

function resolveBasePlan(user, entitlementDoc = null) {
  const permanent = [];

  if (entitlementDoc && premiumStatusGrantsBattlePassAccess(entitlementDoc)) {
    permanent.push(entitlementDocTierToPlan(entitlementDoc.premiumTier));
  }

  const legacyStored = resolveLegacyStoredTierCandidate(user);
  if (legacyStored && isFutureDate(legacyStored.expiresAt)) {
    permanent.push(legacyStored.plan);
  }

  if (isUserStoredMembershipActive(user)) {
    if (!isFoundingTesterGrandRewardMembership(user) && !isWelcomePromoMembership(user)) {
      permanent.push(normalizeCanonicalPlan(user.membershipTier || user.premiumTier));
    }
  }

  if (!permanent.length) return PLAN.FREE;
  return maxCanonicalPlan(...permanent);
}

function buildFeatureLimits(effectivePlan, user) {
  const tierId = planToSubscriptionTierId(effectivePlan);
  let cfg = getTierConfig(tierId);

  if (hasBetaProAccess(user)) {
    cfg = {
      ...cfg,
      ...getBetaModeAccessOverrides(),
      ...BETA_UNLIMITED,
    };
  } else if (hasFoundingTesterAccess(user)) {
    cfg = {
      ...cfg,
      ...BETA_UNLIMITED,
      alertsSpeed: 'priority',
    };
  }

  const alertsSpeed = cfg.alertsSpeed || 'basic';
  const alertSpeedTier =
    alertsSpeed === 'fastest' || alertsSpeed === 'priority'
      ? 'fastest'
      : alertsSpeed === 'faster' || alertsSpeed === 'fast'
        ? 'fast'
        : 'standard';

  return {
    bestMovesPerDay: cfg.bestMovesPerDay,
    alertLimit: cfg.alertsMax,
    alertSpeedTier,
    alertsSpeed: cfg.alertsSpeed,
    scanPriority: planRank(effectivePlan) >= planRank(PLAN.PRO) ? 'highest' : planRank(effectivePlan) >= planRank(PLAN.PREMIUM) ? 'elevated' : 'standard',
    advancedBestMove: planRank(effectivePlan) >= planRank(PLAN.PRO),
    sellerInsights: planRank(effectivePlan) >= planRank(PLAN.PRO),
    eventBonusPct: cfg.eventPointsBonusPct ?? 0,
    subscriptionMultiplier: cfg.multiplier ?? 1,
    projectAlertsEnabled: Boolean(cfg.projectAlertsEnabled),
    projectActiveMax: cfg.projectActiveMax ?? 0,
    projectItemsMaxPerProject: cfg.projectItemsMaxPerProject ?? 0,
  };
}

/**
 * @param {object|null} user - User document or lean object
 * @param {object|null} entitlementDoc - PremiumEntitlement lean doc (optional)
 */
function resolveUserEntitlements(user, entitlementDoc = null) {
  const candidates = collectEntitlementCandidates(user, entitlementDoc);
  const winner = pickWinningCandidate(candidates);
  const basePlan = resolveBasePlan(user, entitlementDoc);
  const effectivePlan = winner.plan;
  const features = buildFeatureLimits(effectivePlan, user);

  const displayTier = planToClientDisplayTier(effectivePlan);
  const legacyMembershipTier = normalizeMembershipTier(effectivePlan);

  return {
    basePlan,
    effectivePlan,
    plan: effectivePlan,
    entitlementSource: winner.source,
    source: winner.source,
    startsAt: winner.startsAt,
    expiresAt: winner.expiresAt,
    features,
    featureLimits: features,
    isPremium: planRank(effectivePlan) >= planRank(PLAN.PREMIUM),
    isPro: effectivePlan === PLAN.PRO,
    displayTier,
    tier: displayTier === 'core' ? 'core' : displayTier === 'pro' ? 'pro' : 'free',
    membershipTier: legacyMembershipTier,
    subscriptionTier: displayTier === 'pro' ? 'pro' : displayTier === 'core' ? 'core' : 'free',
    premiumTier:
      effectivePlan === PLAN.PRO ? 'elite' : effectivePlan === PLAN.PREMIUM ? 'premium' : 'free',
    betaMode: isBetaMode(),
    betaModeProAccess: hasBetaProAccess(user),
    foundingTesterAccess: hasFoundingTesterAccess(user),
    entitlements: {
      pro: effectivePlan === PLAN.PRO,
      premium: planRank(effectivePlan) >= planRank(PLAN.PREMIUM),
      core: planRank(effectivePlan) >= planRank(PLAN.PREMIUM),
      elite: effectivePlan === PLAN.PRO,
    },
  };
}

function toLegacyMeResponse(user, entitlementDoc = null) {
  const resolved = resolveUserEntitlements(user, entitlementDoc);
  const stripeActive =
    entitlementDoc && premiumStatusGrantsBattlePassAccess(entitlementDoc);

  return {
    ...resolved,
    premiumStatus: resolved.isPremium
      ? 'active'
      : stripeActive
        ? entitlementDoc.premiumStatus
        : 'inactive',
    currentPeriodEnd: entitlementDoc?.currentPeriodEnd || membershipExpiry(user) || null,
    cancelAtPeriodEnd: Boolean(entitlementDoc?.cancelAtPeriodEnd),
    trialEndsAt: entitlementDoc?.trialEndsAt || null,
    provider:
      resolved.entitlementSource === ENTITLEMENT_SOURCES.SUBSCRIPTION
        ? entitlementDoc?.provider || 'stripe'
        : resolved.entitlementSource === ENTITLEMENT_SOURCES.BETA
          ? 'beta_mode'
          : resolved.entitlementSource === ENTITLEMENT_SOURCES.FOUNDING_TESTER
            ? 'beta'
            : resolved.entitlementSource === ENTITLEMENT_SOURCES.ADMIN
              ? 'owner'
              : resolved.entitlementSource === ENTITLEMENT_SOURCES.PROMO
                ? 'promo'
                : 'stripe',
    isBetaTester: resolved.foundingTesterAccess,
    betaTester: Boolean(user?.betaTester),
    foundingAccess: Boolean(user?.foundingAccess),
    betaAccessExpiresAt: user?.betaAccessExpiresAt || null,
  };
}

module.exports = {
  ENTITLEMENT_SOURCES,
  resolveUserEntitlements,
  toLegacyMeResponse,
  resolveBasePlan,
  collectEntitlementCandidates,
  isUserStoredMembershipActive,
  isFoundingTesterGrandRewardMembership,
  isWelcomePromoMembership,
  buildFeatureLimits,
};
