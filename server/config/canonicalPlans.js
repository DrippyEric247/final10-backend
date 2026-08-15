/**
 * Canonical Final10 product plan identity (Wave 2).
 *
 * Internal plan IDs: free | premium | pro
 * Marketing labels (core, elite, PREMIUM, PRO) are presentation-only.
 */

const PLAN = Object.freeze({
  FREE: 'free',
  PREMIUM: 'premium',
  PRO: 'pro',
});

const PLAN_RANK = Object.freeze({
  free: 0,
  premium: 1,
  pro: 2,
});

/** Legacy / marketing values → canonical plan. Unknown values fail safe to free. */
function normalizeCanonicalPlan(raw) {
  const tier = String(raw || '').toLowerCase().trim();
  if (!tier || tier === 'free') return PLAN.FREE;
  if (tier === 'pro' || tier === 'elite' || tier.includes('14') || tier === 'savvy_pro') return PLAN.PRO;
  if (
    tier === 'premium' ||
    tier === 'core' ||
    tier.includes('plus') ||
    tier.includes('7') ||
    tier === 'savvy_plus'
  ) {
    return PLAN.PREMIUM;
  }
  if (tier === 'vip') return PLAN.PREMIUM;
  return PLAN.FREE;
}

function planRank(plan) {
  return PLAN_RANK[normalizeCanonicalPlan(plan)] ?? 0;
}

function maxCanonicalPlan(...plans) {
  let best = PLAN.FREE;
  let bestRank = 0;
  for (const p of plans) {
    const normalized = normalizeCanonicalPlan(p);
    const rank = planRank(normalized);
    if (rank > bestRank) {
      bestRank = rank;
      best = normalized;
    }
  }
  return best;
}

/** Maps canonical plan → subscriptionPlans.js tier id (free | core | pro). */
function planToSubscriptionTierId(plan) {
  const p = normalizeCanonicalPlan(plan);
  if (p === PLAN.PRO) return 'pro';
  if (p === PLAN.PREMIUM) return 'core';
  return 'free';
}

/** Client display tier (legacy UI: free | core | pro | elite). */
function planToClientDisplayTier(plan) {
  const p = normalizeCanonicalPlan(plan);
  if (p === PLAN.PRO) return 'pro';
  if (p === PLAN.PREMIUM) return 'core';
  return 'free';
}

/** PremiumEntitlement.premiumTier → canonical plan. */
function entitlementDocTierToPlan(premiumTier) {
  const t = String(premiumTier || '').toLowerCase();
  if (t === 'elite') return PLAN.PRO;
  if (t === 'premium' || t === 'vip') return PLAN.PREMIUM;
  return PLAN.FREE;
}

/** Legacy membershipFields normalizeMembershipTier — re-export alias for migration reads. */
function legacyMembershipTierToPlan(raw) {
  return normalizeCanonicalPlan(raw);
}

module.exports = {
  PLAN,
  PLAN_RANK,
  normalizeCanonicalPlan,
  planRank,
  maxCanonicalPlan,
  planToSubscriptionTierId,
  planToClientDisplayTier,
  entitlementDocTierToPlan,
  legacyMembershipTierToPlan,
};
