/**
 * Quantum Egg — universal account-level ownership + legacy snapshot.
 *
 * Unlock: secret 30 qualifying deal streak via authoritative Deal Streak engine.
 * Does NOT activate economy bonuses or duplicate cross-app ownership.
 */

const User = require('../models/User');
const {
  QUANTUM_EGG_VERSION,
  QUANTUM_ACHIEVEMENT_ID,
  QUANTUM_KEYCHAIN_ITEM_ID,
  QUANTUM_NUKE_DEAL_STREAK_TARGET,
  isQuantumDealStreakEligible,
  isQuantumLegacyUnlocked,
} = require('../config/quantumEgg');
const { auditFireAndForget } = require('./securityAuditService');
const { isFounderAdminEmail } = require('../lib/founderAdminAccess');

const ORIGINATING_APP = 'final10';

function canAccessQuantumAdminPreview(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return true;
  if (typeof user.isAdmin === 'function' && user.isAdmin()) return true;
  if (typeof user.isSuperAdmin === 'function' && user.isSuperAdmin()) return true;
  return isFounderAdminEmail(user.email);
}

function ensureQuantumLegacy(user) {
  if (!user.quantumLegacy || typeof user.quantumLegacy !== 'object') {
    user.quantumLegacy = {
      unlocked: false,
      unlockedAt: null,
      discoveredAt: null,
      achievementId: null,
      originatingApp: null,
      dealStreakAtUnlock: null,
      profileLevelAtUnlock: null,
      prestigeAtUnlock: null,
      pendingReveal: false,
      universal: true,
      crossApp: true,
    };
  }
  const q = user.quantumLegacy;
  if (q.unlocked == null) q.unlocked = false;
  if (q.pendingReveal == null) q.pendingReveal = false;
  if (q.universal == null) q.universal = true;
  if (q.crossApp == null) q.crossApp = true;
  return q;
}

async function loadAccountSnapshot(userId) {
  let profileLevel = 1;
  let prestige = 0;
  try {
    const { getProfileProgress } = require('./profileXpService');
    const progress = await getProfileProgress(userId);
    profileLevel = Math.max(1, Number(progress?.profileLevel ?? progress?.level) || 1);
    prestige = Math.max(0, Number(progress?.prestige) || 0);
  } catch {
    /* non-fatal */
  }
  return { profileLevel, prestige };
}

/**
 * Evaluate and grant Quantum Egg + keychain when secret streak is satisfied.
 * Idempotent — duplicate grants are ignored.
 * @returns {Promise<{ granted: boolean, pendingReveal: boolean }>}
 */
async function evaluateQuantumEggUnlock(user, source = 'secret_nuke_deal_streak') {
  const legacy = ensureQuantumLegacy(user);
  if (legacy.unlocked) return { granted: false, pendingReveal: Boolean(legacy.pendingReveal) };

  const currentDealStreak = Math.max(0, Number(user.dealStreak?.currentDealStreak) || 0);
  if (!isQuantumDealStreakEligible(currentDealStreak)) {
    return { granted: false, pendingReveal: false };
  }

  const snapshot = await loadAccountSnapshot(user._id);
  const now = new Date();

  legacy.unlocked = true;
  legacy.unlockedAt = now;
  legacy.discoveredAt = now;
  legacy.achievementId = QUANTUM_ACHIEVEMENT_ID;
  legacy.originatingApp = ORIGINATING_APP;
  legacy.dealStreakAtUnlock = currentDealStreak;
  legacy.profileLevelAtUnlock = snapshot.profileLevel;
  legacy.prestigeAtUnlock = snapshot.prestige;
  legacy.pendingReveal = true;
  legacy.universal = true;
  legacy.crossApp = true;

  user.markModified('quantumLegacy');

  let keychainGranted = false;
  try {
    const { grantEggKeychainUnlock } = require('./eggKeychainService');
    const result = await grantEggKeychainUnlock(user._id, QUANTUM_KEYCHAIN_ITEM_ID, source, {
      profileLevel: snapshot.profileLevel,
      prestige: snapshot.prestige,
      userId: String(user._id),
      username: user.username || '',
    });
    keychainGranted = result.granted;
  } catch (err) {
    console.error('[quantum-egg] keychain grant failed', err?.message || err);
  }

  auditFireAndForget('QUANTUM_EGG_UNLOCKED', {
    userId: user._id,
    meta: {
      achievementId: QUANTUM_ACHIEVEMENT_ID,
      source: String(source || 'secret_nuke_deal_streak').slice(0, 64),
      dealStreakAtUnlock: currentDealStreak,
      keychainGranted,
    },
  });

  await user.save();

  return { granted: true, pendingReveal: true };
}

/**
 * Public-safe quantum state — never exposes secret target or remaining count.
 */
function buildQuantumPublicState(user, { adminPreview = false } = {}) {
  const legacy = ensureQuantumLegacy(user);
  const unlocked = isQuantumLegacyUnlocked(legacy);

  if (!unlocked && !adminPreview) {
    return {
      visible: false,
      classified: true,
      pendingReveal: false,
    };
  }

  if (!unlocked && adminPreview) {
    return {
      visible: true,
      classified: true,
      adminPreview: true,
      unlocked: false,
      version: QUANTUM_EGG_VERSION,
      pendingReveal: false,
    };
  }

  return {
    visible: true,
    classified: false,
    unlocked: true,
    version: QUANTUM_EGG_VERSION,
    universal: true,
    crossApp: true,
    pendingReveal: Boolean(legacy.pendingReveal),
    legacy: {
      unlockedAt: legacy.unlockedAt ? new Date(legacy.unlockedAt).toISOString() : null,
      achievementId: legacy.achievementId || QUANTUM_ACHIEVEMENT_ID,
      originatingApp: legacy.originatingApp || ORIGINATING_APP,
      dealStreakAtUnlock: legacy.dealStreakAtUnlock ?? null,
      profileLevelAtUnlock: legacy.profileLevelAtUnlock ?? null,
      prestigeAtUnlock: legacy.prestigeAtUnlock ?? null,
    },
  };
}

async function acknowledgeQuantumReveal(user) {
  const legacy = ensureQuantumLegacy(user);
  if (!legacy.pendingReveal) return buildQuantumPublicState(user);
  legacy.pendingReveal = false;
  user.markModified('quantumLegacy');
  await user.save();
  return buildQuantumPublicState(user);
}

function isQuantumEggKeychainEligible(user) {
  return isQuantumLegacyUnlocked(ensureQuantumLegacy(user));
}

module.exports = {
  QUANTUM_EGG_VERSION,
  QUANTUM_KEYCHAIN_ITEM_ID,
  QUANTUM_NUKE_DEAL_STREAK_TARGET,
  QUANTUM_ACHIEVEMENT_ID,
  canAccessQuantumAdminPreview,
  ensureQuantumLegacy,
  evaluateQuantumEggUnlock,
  buildQuantumPublicState,
  acknowledgeQuantumReveal,
  isQuantumEggKeychainEligible,
  isQuantumLegacyUnlocked,
  isQuantumDealStreakEligible,
  evaluateQuantumEggUnlock,
  buildQuantumPublicState,
  acknowledgeQuantumReveal,
  canAccessQuantumAdminPreview,
};
