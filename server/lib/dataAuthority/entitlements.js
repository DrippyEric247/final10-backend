/**
 * Wave 6 — centralized entitlement reads for authorization paths.
 * Display-only legacy field reads should NOT use this; use resolveUserEntitlements directly.
 */

const { resolveUserEntitlements } = require('../../services/userEntitlementService');
const { getEntitlementByUserId } = require('../../services/premiumEntitlementService');

function resolveEntitlementsFromUser(user, entitlementDoc = null) {
  return resolveUserEntitlements(user, entitlementDoc);
}

async function resolveEntitlementsForUserId(userId, userDoc = null) {
  const User = require('../../models/User');
  const user = userDoc || (await User.findById(userId));
  if (!user) return null;
  const ent = await getEntitlementByUserId(userId);
  return resolveUserEntitlements(user, ent);
}

function isFreeEffectivePlan(resolved) {
  return !resolved || resolved.effectivePlan === 'free';
}

function isPaidEffectivePlan(resolved) {
  return Boolean(resolved && resolved.effectivePlan && resolved.effectivePlan !== 'free');
}

function subscriptionTierIdFromResolved(resolved) {
  const plan = resolved?.effectivePlan || 'free';
  if (plan === 'pro') return 'pro';
  if (plan === 'premium') return 'core';
  return 'free';
}

function planTierForMultiplier(user, entitlementDoc = null) {
  const resolved = resolveUserEntitlements(user, entitlementDoc);
  return subscriptionTierIdFromResolved(resolved);
}

module.exports = {
  resolveEntitlementsFromUser,
  resolveEntitlementsForUserId,
  isFreeEffectivePlan,
  isPaidEffectivePlan,
  subscriptionTierIdFromResolved,
  planTierForMultiplier,
};
