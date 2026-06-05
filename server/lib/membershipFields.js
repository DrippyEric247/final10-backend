/**
 * Canonical membership field mapping for User, auth/me, entitlements, and owner updates.
 */

function normalizeMembershipTier(raw) {
  const t = String(raw || 'free').toLowerCase();
  if (t === 'pro' || t === 'premium' || t === 'free') return t;
  if (t === 'core') return 'premium';
  if (t === 'elite') return 'pro';
  return 'free';
}

/** Client gating tier: free | core | pro | elite */
function clientTierFromUser(user) {
  if (!user) return 'free';
  const membershipTier = normalizeMembershipTier(user.membershipTier || user.premiumTier);
  const isPremium = Boolean(user.isPremium);
  if (!isPremium) return 'free';
  if (membershipTier === 'pro') return 'pro';
  if (membershipTier === 'premium') return 'core';
  const subTier = String(user.subscription?.tier || '').toLowerCase();
  if (subTier === 'pro' || subTier === 'elite') return subTier === 'elite' ? 'elite' : 'pro';
  if (subTier === 'core') return 'core';
  return 'core';
}

function subscriptionTierFromMembership(membershipTier) {
  const t = normalizeMembershipTier(membershipTier);
  if (t === 'pro') return 'pro';
  if (t === 'premium') return 'core';
  return 'free';
}

function isMembershipCurrentlyActive(user) {
  if (!user || !user.isPremium) return false;
  if (!user.subscriptionExpires) return true;
  const exp = new Date(user.subscriptionExpires);
  return !Number.isNaN(exp.getTime()) && exp > new Date();
}

function buildMembershipEntitlements(user) {
  const membershipTier = normalizeMembershipTier(user?.membershipTier);
  const active = isMembershipCurrentlyActive(user);
  return {
    pro: active && membershipTier === 'pro',
    premium: active && (membershipTier === 'premium' || membershipTier === 'pro'),
    core: active && membershipTier === 'premium',
    elite: active && membershipTier === 'pro',
  };
}

/**
 * Mongo $set fields for owner membership update.
 */
function buildOwnerMembershipMongoSet(membershipTier, durationMonths) {
  const tier = normalizeMembershipTier(membershipTier);
  const monthsRaw = parseInt(String(durationMonths), 10);
  const months = Number.isFinite(monthsRaw) ? monthsRaw : 12;

  const $set = {
    membershipTier: tier,
    premiumTier: tier === 'free' ? 'free' : tier === 'premium' ? 'premium' : 'pro',
    tier,
    plan: tier,
    subscriptionTier: subscriptionTierFromMembership(tier),
    'subscription.tier': subscriptionTierFromMembership(tier),
  };

  let subscriptionExpires = null;
  let membershipExpiresAt = null;

  if (tier === 'free') {
    $set.isPremium = false;
    $set.premium = false;
    $set.subscriptionExpires = null;
    $set.membershipExpiresAt = null;
    $set['subscription.renewalDate'] = null;
    $set['subscription.badge'] = '';
  } else if (tier === 'pro' && months === 0) {
    $set.isPremium = true;
    $set.premium = true;
    $set.subscriptionExpires = null;
    $set.membershipExpiresAt = null;
    $set['subscription.renewalDate'] = null;
    $set['subscription.badge'] = 'PRO';
  } else {
    const span = Math.max(1, months || 12);
    const expires = new Date();
    expires.setMonth(expires.getMonth() + span);
    subscriptionExpires = expires;
    membershipExpiresAt = expires;
    $set.isPremium = true;
    $set.premium = true;
    $set.subscriptionExpires = expires;
    $set.membershipExpiresAt = expires;
    $set['subscription.renewalDate'] = expires;
    $set['subscription.badge'] = tier === 'pro' ? 'PRO' : 'Premium';
  }

  return { tier, months, $set, subscriptionExpires, membershipExpiresAt };
}

/** Serialized membership block for auth/me and owner API responses. */
function serializeMembershipForClient(user) {
  const membershipTier = normalizeMembershipTier(user?.membershipTier);
  const isPremium = Boolean(user?.isPremium);
  const tier = clientTierFromUser(user);
  const active = isMembershipCurrentlyActive(user);
  const expires = user?.subscriptionExpires || user?.membershipExpiresAt || null;

  return {
    membershipTier,
    isPremium,
    premium: isPremium,
    tier: active ? tier : 'free',
    plan: membershipTier,
    subscriptionTier: subscriptionTierFromMembership(membershipTier),
    membershipExpiresAt: expires,
    subscriptionExpires: expires,
    hasLifetimeSub: isPremium && !expires,
    entitlements: buildMembershipEntitlements(user),
  };
}

module.exports = {
  normalizeMembershipTier,
  clientTierFromUser,
  subscriptionTierFromMembership,
  isMembershipCurrentlyActive,
  buildMembershipEntitlements,
  buildOwnerMembershipMongoSet,
  serializeMembershipForClient,
};
