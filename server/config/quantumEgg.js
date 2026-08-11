/**
 * Quantum Egg — server mirror of @savvy/core config.
 * SOURCE OF TRUTH: packages/savvy-core/src/config/quantumEgg.js
 */

const QUANTUM_EGG_VERSION = 1;
const QUANTUM_EGG_RARITY = 'quantum';
const QUANTUM_EGG_COLLECTION_ID = 'quantum-legacy';
const QUANTUM_EGG_DISPLAY_NAME = 'QUANTUM LEGACY';
const QUANTUM_NUKE_DEAL_STREAK_TARGET = 30;
const QUANTUM_ACHIEVEMENT_ID = 'secret_nuke_deal_streak_30';
const QUANTUM_KEYCHAIN_ITEM_ID = 'keychain_quantum_egg';
const QUANTUM_EGG_KEYCHAIN_SLUG = 'quantum-egg-keychain';

const QUANTUM_CLASSIFIED_UI = Object.freeze({
  name: '???',
  displayName: 'CLASSIFIED',
  collectionLabel: 'QUANTUM LEGACY',
  lockedRequirementLabel: 'HIDDEN LEGACY',
  statusLabel: 'UNKNOWN REQUIREMENT',
  badge: 'CLASSIFIED',
});

const QUANTUM_EGG_TAGLINE = 'BEYOND MYTHIC. ACROSS THE UNIVERSE.';
const QUANTUM_EGG_SECONDARY_TAGLINE = 'ONE EGG. EVERY WORLD. ENDLESS POSSIBILITIES.';
const QUANTUM_EGG_ACQUIRED_LABEL = 'QUANTUM EGG KEYCHAIN ACQUIRED';

function isQuantumDealStreakEligible(currentDealStreak) {
  return Math.max(0, Number(currentDealStreak) || 0) >= QUANTUM_NUKE_DEAL_STREAK_TARGET;
}

function isQuantumLegacyUnlocked(legacy) {
  return Boolean(legacy?.unlocked);
}

module.exports = {
  QUANTUM_EGG_VERSION,
  QUANTUM_EGG_RARITY,
  QUANTUM_EGG_COLLECTION_ID,
  QUANTUM_EGG_DISPLAY_NAME,
  QUANTUM_NUKE_DEAL_STREAK_TARGET,
  QUANTUM_ACHIEVEMENT_ID,
  QUANTUM_KEYCHAIN_ITEM_ID,
  QUANTUM_EGG_KEYCHAIN_SLUG,
  QUANTUM_CLASSIFIED_UI,
  QUANTUM_EGG_TAGLINE,
  QUANTUM_EGG_SECONDARY_TAGLINE,
  QUANTUM_EGG_ACQUIRED_LABEL,
  isQuantumDealStreakEligible,
  isQuantumLegacyUnlocked,
};
