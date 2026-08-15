/** Server-authoritative entitlement cache (Wave 2). Production gating reads this, not localStorage. */

let serverEntitlements = null;

export function setServerEntitlements(entitlements) {
  serverEntitlements = entitlements || null;
  try {
    window.dispatchEvent(new CustomEvent('f10:entitlements-updated'));
  } catch {
    /* ignore */
  }
}

export function clearServerEntitlements() {
  serverEntitlements = null;
}

export function getServerEntitlements() {
  return serverEntitlements;
}

export function getAuthoritativeEffectivePlan() {
  const ent = serverEntitlements;
  if (!ent) return null;
  return ent.effectivePlan || ent.plan || null;
}

export function getAuthoritativeFeatureLimits() {
  const ent = serverEntitlements;
  if (!ent) return null;
  return ent.featureLimits || ent.features || null;
}

/** Map canonical plan (free|premium|pro) → client tier id used by tierMultiplier. */
export function canonicalPlanToClientTier(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'pro') return 'pro';
  if (p === 'premium') return 'core';
  return 'free';
}

export function syncServerEntitlementsFromApiPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    setServerEntitlements(null);
    return null;
  }

  const nested = payload.entitlements;
  if (nested && typeof nested === 'object' && nested.effectivePlan) {
    setServerEntitlements({
      basePlan: nested.basePlan,
      effectivePlan: nested.effectivePlan,
      entitlementSource: nested.entitlementSource,
      expiresAt: nested.expiresAt,
      featureLimits: nested.featureLimits,
      displayTier: nested.displayTier,
    });
    return serverEntitlements;
  }

  setServerEntitlements({
    basePlan: payload.basePlan || 'free',
    effectivePlan: payload.effectivePlan || payload.plan || 'free',
    entitlementSource: payload.entitlementSource || payload.source || 'free',
    expiresAt: payload.expiresAt || payload.currentPeriodEnd || null,
    featureLimits: payload.featureLimits || payload.features || null,
    displayTier: payload.displayTier || payload.tier || 'free',
  });
  return serverEntitlements;
}
