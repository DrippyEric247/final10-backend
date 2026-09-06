/**
 * Progression scope model — global vs app vs feature.
 * @module @savvy/core/core/scope
 */

export const SCOPE_TYPES = Object.freeze({
  GLOBAL: 'global',
  APP: 'app',
  FEATURE: 'feature',
});

/**
 * @param {string} scopeType
 * @param {string|null} scopeId
 */
export function normalizeScope(scopeType = SCOPE_TYPES.GLOBAL, scopeId = null) {
  const type = String(scopeType || SCOPE_TYPES.GLOBAL).trim().toLowerCase();
  if (!Object.values(SCOPE_TYPES).includes(type)) {
    throw new Error(`Invalid scopeType: ${scopeType}`);
  }
  return {
    scopeType: type,
    scopeId: scopeId ? String(scopeId).trim().toLowerCase() : null,
  };
}
