/**
 * Perk scope helpers — keep in sync with packages/savvy-core/src/core/perkScope.js
 */
const SCOPE_TYPES = Object.freeze({
  GLOBAL: 'global',
  APP: 'app',
  FEATURE: 'feature',
});

function normalizeScope(scopeType = SCOPE_TYPES.GLOBAL, scopeId = null) {
  const type = String(scopeType || SCOPE_TYPES.GLOBAL).trim().toLowerCase();
  if (!Object.values(SCOPE_TYPES).includes(type)) {
    throw new Error(`Invalid scopeType: ${scopeType}`);
  }
  return {
    scopeType: type,
    scopeId: scopeId ? String(scopeId).trim().toLowerCase() : null,
  };
}

function normalizePerkScope({ perkId, scopeType = SCOPE_TYPES.GLOBAL, scopeId = null } = {}) {
  const scope = normalizeScope(scopeType, scopeId);
  return {
    perkId: String(perkId || '').trim(),
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
  };
}

function isPerkEligibleInContext(perkScope, { appId = null, featureId = null } = {}) {
  if (!perkScope?.perkId) return false;
  if (perkScope.scopeType === SCOPE_TYPES.GLOBAL) return true;
  if (perkScope.scopeType === SCOPE_TYPES.APP) {
    return Boolean(appId) && String(perkScope.scopeId) === String(appId).trim().toLowerCase();
  }
  if (perkScope.scopeType === SCOPE_TYPES.FEATURE) {
    return Boolean(featureId) && String(perkScope.scopeId) === String(featureId).trim().toLowerCase();
  }
  return false;
}

module.exports = {
  SCOPE_TYPES,
  normalizePerkScope,
  isPerkEligibleInContext,
};
