const { getTierConfig } = require('../config/subscriptionPlans');
const { BETA_UNLIMITED, BETA_FEEDBACK_SAVVY_BONUS } = require('../config/betaTester');
const {
  isBetaMode,
  hasBetaProAccess,
  getBetaModeAccessOverrides,
  getBetaProTier,
} = require('../config/betaMode');
const { resolveUserEntitlements, buildFeatureLimits } = require('./userEntitlementService');
const { planToSubscriptionTierId } = require('../config/canonicalPlans');

function isBetaTester(user) {
  if (!user) return false;
  if (hasBetaProAccess(user)) return true;
  if (typeof user.hasFoundingTesterAccess === 'function') {
    return user.hasFoundingTesterAccess();
  }
  const flagged = Boolean(user.betaTester || user.foundingAccess);
  if (!flagged) return false;
  if (!user.betaAccessExpiresAt) return true;
  return new Date(user.betaAccessExpiresAt) > new Date();
}

function readUserTier(user, entitlementDoc = null) {
  const resolved = resolveUserEntitlements(user, entitlementDoc);
  return planToSubscriptionTierId(resolved.effectivePlan);
}

/** Tier config with unlimited caps when beta tester or global beta mode is active. */
function getTierConfigForUser(user, entitlementDoc = null) {
  const resolved = resolveUserEntitlements(user, entitlementDoc);
  const tierId = planToSubscriptionTierId(resolved.effectivePlan);
  const base = getTierConfig(tierId);

  if (hasBetaProAccess(user)) {
    return {
      ...base,
      ...getBetaModeAccessOverrides(),
      ...BETA_UNLIMITED,
    };
  }
  if (!isBetaTester(user)) return base;
  return {
    ...base,
    ...BETA_UNLIMITED,
    label: 'Founding Tester',
    alertsSpeed: 'priority',
  };
}

/** Feature limits from canonical entitlement resolver. */
function getFeatureLimitsForUser(user, entitlementDoc = null) {
  const resolved = resolveUserEntitlements(user, entitlementDoc);
  return resolved.features;
}

async function logBetaUsage(userId, action, meta = {}) {
  try {
    const BetaTesterUsageLog = require('../models/BetaTesterUsageLog');
    await BetaTesterUsageLog.create({
      userId,
      action: String(action || 'unknown').slice(0, 80),
      meta: meta && typeof meta === 'object' ? meta : {},
    });
  } catch (err) {
    console.warn('[betaTester] usage log failed:', err?.message);
  }
}

module.exports = {
  isBetaTester,
  readUserTier,
  getTierConfigForUser,
  getFeatureLimitsForUser,
  logBetaUsage,
  BETA_FEEDBACK_SAVVY_BONUS,
  hasBetaProAccess,
  isBetaMode,
  buildFeatureLimits,
};
