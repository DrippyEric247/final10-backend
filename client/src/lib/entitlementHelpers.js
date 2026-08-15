import { getAuthoritativeEffectivePlan, getServerEntitlements } from './entitlementCache';

export function getEffectivePlanFromUser(user) {
  const nested = user?.entitlements?.effectivePlan;
  if (nested) return nested;
  return getAuthoritativeEffectivePlan();
}

export function hasEffectivePremium(user) {
  const plan = getEffectivePlanFromUser(user);
  return plan === 'premium' || plan === 'pro';
}

export function hasEffectivePro(user) {
  return getEffectivePlanFromUser(user) === 'pro';
}

export function getFeatureLimitsFromUser(user) {
  const nested = user?.entitlements?.featureLimits;
  if (nested) return nested;
  const ent = getServerEntitlements();
  return ent?.featureLimits || null;
}

export function isPremiumEntitled(user) {
  const ent = getServerEntitlements();
  if (ent?.effectivePlan) {
    return ent.effectivePlan === 'premium' || ent.effectivePlan === 'pro';
  }
  if (user?.entitlements?.effectivePlan) {
    return user.entitlements.effectivePlan === 'premium' || user.entitlements.effectivePlan === 'pro';
  }
  return false;
}

export function isProEntitled(user) {
  const ent = getServerEntitlements();
  if (ent?.effectivePlan) return ent.effectivePlan === 'pro';
  if (user?.entitlements?.effectivePlan) return user.entitlements.effectivePlan === 'pro';
  return false;
}
