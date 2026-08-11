/**
 * Quantum Egg — universal Savvy Universe collectible (above Mythic).
 *
 * Secret unlock: 30 consecutive qualifying deals on the authoritative Deal Streak
 * counter (`currentDealStreak`). This is NOT the per-category Nuke camo streak.
 *
 * Server mirror: `server/config/quantumEgg.js`
 *
 * @module @savvy/core/config/quantumEgg
 */

/** Bump when unlock rules or legacy fields change. */
export const QUANTUM_EGG_VERSION = 1;

/** Authoritative internal rarity — one tier only. */
export const QUANTUM_EGG_RARITY = 'quantum';

export const QUANTUM_EGG_COLLECTION_ID = 'quantum-legacy';

export const QUANTUM_EGG_DISPLAY_NAME = 'QUANTUM LEGACY';

/** Secret overall deal streak target (reuse Deal Streak engine — never duplicate counters). */
export const QUANTUM_NUKE_DEAL_STREAK_TARGET = 30;

export const QUANTUM_ACHIEVEMENT_ID = 'secret_nuke_deal_streak_30';

export const QUANTUM_KEYCHAIN_ITEM_ID = 'keychain_quantum_egg';

export const QUANTUM_EGG_KEYCHAIN_SLUG = 'quantum-egg-keychain';

/** UI copy — safe to show before discovery (no target numbers). */
export const QUANTUM_CLASSIFIED_UI = Object.freeze({
  name: '???',
  displayName: 'CLASSIFIED',
  collectionLabel: 'QUANTUM LEGACY',
  lockedRequirementLabel: 'HIDDEN LEGACY',
  statusLabel: 'UNKNOWN REQUIREMENT',
  badge: 'CLASSIFIED',
});

export const QUANTUM_EGG_TAGLINE = 'BEYOND MYTHIC. ACROSS THE UNIVERSE.';

export const QUANTUM_EGG_SECONDARY_TAGLINE = 'ONE EGG. EVERY WORLD. ENDLESS POSSIBILITIES.';

export const QUANTUM_EGG_ACQUIRED_LABEL = 'QUANTUM EGG KEYCHAIN ACQUIRED';

/**
 * Whether overall deal streak satisfies Quantum eligibility.
 * @param {number} currentDealStreak
 */
export function isQuantumDealStreakEligible(currentDealStreak) {
  return Math.max(0, Number(currentDealStreak) || 0) >= QUANTUM_NUKE_DEAL_STREAK_TARGET;
}

/**
 * Public-safe quantum visibility — never leak secret target before unlock.
 * @param {{ unlocked?: boolean }|null|undefined} legacy
 */
export function isQuantumLegacyUnlocked(legacy) {
  return Boolean(legacy?.unlocked);
}
