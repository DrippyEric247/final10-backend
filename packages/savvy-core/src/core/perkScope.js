/**
 * Perk / Egg scope helpers — prevent cross-app perk bleed.
 * @module @savvy/core/core/perkScope
 */

import { SCOPE_TYPES, normalizeScope } from './scope.js';

/**
 * @typedef {Object} PerkScope
 * @property {string} perkId
 * @property {'global'|'app'|'feature'} scopeType
 * @property {string|null} scopeId
 */

/**
 * @param {Partial<PerkScope>} input
 * @returns {PerkScope}
 */
export function normalizePerkScope({ perkId, scopeType = SCOPE_TYPES.GLOBAL, scopeId = null } = {}) {
  const scope = normalizeScope(scopeType, scopeId);
  return {
    perkId: String(perkId || '').trim(),
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
  };
}

/**
 * Whether a perk is usable in the requesting app context.
 * @param {PerkScope} perkScope
 * @param {{ appId?: string, featureId?: string }} context
 */
export function isPerkEligibleInContext(perkScope, { appId = null, featureId = null } = {}) {
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
