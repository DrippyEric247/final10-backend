const { getTierConfig, normalizeTier } = require('../config/subscriptionPlans');
const { BETA_UNLIMITED, BETA_FEEDBACK_SAVVY_BONUS } = require('../config/betaTester');
const {
  isBetaMode,
  hasBetaProAccess,
  getBetaModeAccessOverrides,
  getBetaProTier,
} = require('../config/betaMode');

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

function readUserTier(user) {
  if (hasBetaProAccess(user)) return getBetaProTier();
  return normalizeTier(user?.subscription?.tier || user?.membershipTier || 'free');
}

/** Tier config with unlimited caps when beta tester or global beta mode is active. */
function getTierConfigForUser(user) {
  if (hasBetaProAccess(user)) {
    const base = getTierConfig(getBetaProTier());
    return {
      ...base,
      ...getBetaModeAccessOverrides(),
      ...BETA_UNLIMITED,
    };
  }
  const base = getTierConfig(readUserTier(user));
  if (!isBetaTester(user)) return base;
  return {
    ...base,
    ...BETA_UNLIMITED,
    label: 'Founding Tester',
    alertsSpeed: 'priority',
  };
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
  logBetaUsage,
  BETA_FEEDBACK_SAVVY_BONUS,
  hasBetaProAccess,
  isBetaMode,
};
