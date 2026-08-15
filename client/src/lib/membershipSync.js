import { normalizeSubscriptionTier, setCurrentSubscriptionTier } from './tierMultiplier';
import { syncServerEntitlementsFromApiPayload } from './entitlementCache';

function pickClientTier(user, entitlements) {
  const effective = entitlements?.effectivePlan || entitlements?.plan;
  if (effective) {
    if (effective === 'pro') return 'pro';
    if (effective === 'premium') return 'core';
    return 'free';
  }
  const direct =
    entitlements?.tier ||
    user?.tier ||
    user?.subscription?.tier ||
    user?.subscriptionTier;
  if (direct) {
    const t = String(direct).toLowerCase();
    if (t === 'core' || t === 'pro' || t === 'elite' || t === 'free') return t;
    if (t === 'premium') return 'core';
  }
  return normalizeSubscriptionTier(
    user?.membershipTier || user?.premiumTier || user?.plan || entitlements?.membershipTier,
    Boolean(user?.isPremium || user?.premium || entitlements?.isPremium)
  );
}

export function syncSubscriptionTierFromUser(user, entitlements = null) {
  const tier = pickClientTier(user, entitlements);
  setCurrentSubscriptionTier(tier);
  return tier;
}

export function getMembershipBadgeLabel(user, entitlements = null) {
  const tier = pickClientTier(user, entitlements);
  if (tier === 'pro' || tier === 'elite') return 'PRO ACTIVE';
  if (tier === 'core') return 'Premium Active';
  return null;
}

/** Refresh localStorage tier + dispatch event after auth/me or entitlements/me. */
export async function hydrateMembershipFromApi(user, fetchEntitlements) {
  if (!user) {
    setCurrentSubscriptionTier('free');
    return { tier: 'free', entitlements: null };
  }

  let ent = null;
  if (typeof fetchEntitlements === 'function') {
    try {
      ent = await fetchEntitlements();
      syncServerEntitlementsFromApiPayload(ent);
    } catch {
      ent = null;
      syncServerEntitlementsFromApiPayload(null);
    }
  }

  if (user?.entitlements) {
    syncServerEntitlementsFromApiPayload(user);
  }

  const tier = syncSubscriptionTierFromUser(user, ent);
  return { tier, entitlements: ent };
}
