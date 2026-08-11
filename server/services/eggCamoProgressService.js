/**
 * Egg Camo Collection — authoritative lifetime Egg mastery progression.
 *
 * Every legitimate perk-machine egg grant must flow through
 * `recordLegitimateEggAcquisition()` so counts stay consistent.
 */

const {
  EGG_CAMO_COLLECTION_VERSION,
  EGG_CAMO_IDS,
  EGG_CAMO_COUNTABLE_SOURCES,
  EGG_CAMO_COLLECTION_MASTERED_EVENT,
  isHatchableEggTier,
  evaluateEggCamoUnlock,
  buildEggCamoRows,
  summarizeEggCamoCollection,
  getClosestEggCamo,
  emptyEggCamoLifetimeCollected,
  emptyEggCamoUnlockMap,
  getEggCamoRequirement,
} = require('../config/eggCamoCollection');
const { auditFireAndForget } = require('./securityAuditService');

function isCountableSource(source) {
  return EGG_CAMO_COUNTABLE_SOURCES.includes(String(source || '').trim());
}

function ensureEggCamoProgress(user) {
  if (!user.eggCamoProgress) {
    user.eggCamoProgress = {
      lifetimeCollected: emptyEggCamoLifetimeCollected(),
      unlockedCamos: emptyEggCamoUnlockMap(),
      unlockHistory: {},
      collectionMastered: false,
      collectionMasteredAt: null,
      backfilledAt: null,
      pendingUnlockCelebrations: [],
    };
  }
  const p = user.eggCamoProgress;
  if (!p.lifetimeCollected) p.lifetimeCollected = emptyEggCamoLifetimeCollected();
  if (!p.unlockedCamos) p.unlockedCamos = emptyEggCamoUnlockMap();
  if (!p.unlockHistory || typeof p.unlockHistory !== 'object') p.unlockHistory = {};
  if (!Array.isArray(p.pendingUnlockCelebrations)) p.pendingUnlockCelebrations = [];
  for (const tier of ['common', 'rare', 'epic', 'legendary', 'mythic']) {
    if (p.lifetimeCollected[tier] == null) p.lifetimeCollected[tier] = 0;
  }
  for (const id of EGG_CAMO_IDS) {
    if (p.unlockedCamos[id] == null) p.unlockedCamos[id] = false;
  }
  return p;
}

async function loadAccountSnapshot(userId) {
  let accountLevelAtUnlock = 1;
  let prestigeAtUnlock = 0;
  try {
    const { getProfileProgress } = require('./profileXpService');
    const progress = await getProfileProgress(userId);
    accountLevelAtUnlock = Math.max(1, Number(progress?.profileLevel ?? progress?.level) || 1);
    prestigeAtUnlock = Math.max(0, Number(progress?.prestige) || 0);
  } catch {
    /* non-fatal */
  }
  return { accountLevelAtUnlock, prestigeAtUnlock };
}

function countEggsFromReward(reward) {
  if (!reward || reward.type !== 'egg') return null;
  const tier = reward.eggTier;
  if (!isHatchableEggTier(tier)) return null;
  return { tier, quantity: Math.max(1, Number(reward.quantity) || 1) };
}

function backfillLifetimeCollectedFromHistory(user) {
  const progress = ensureEggCamoProgress(user);
  if (progress.backfilledAt) return progress;

  const counts = emptyEggCamoLifetimeCollected();
  const pm = user.perkMachine || {};

  for (const entry of pm.spinHistory || []) {
    const rewards = Array.isArray(entry?.rewards) ? entry.rewards : entry?.rewards ? [entry.rewards] : [];
    for (const reward of rewards) {
      const parsed = countEggsFromReward(reward);
      if (parsed) counts[parsed.tier] += parsed.quantity;
    }
  }

  for (const entry of pm.eggExchangeHistory || []) {
    const tier = entry?.toTier;
    if (isHatchableEggTier(tier)) counts[tier] += 1;
  }

  for (const tier of Object.keys(counts)) {
    progress.lifetimeCollected[tier] = Math.max(
      Number(progress.lifetimeCollected[tier]) || 0,
      counts[tier]
    );
  }

  progress.backfilledAt = new Date();
  user.markModified('eggCamoProgress');
  return progress;
}

function evaluateAndPersistUnlocks(user, accountSnapshot, unlockSource = 'system') {
  const progress = ensureEggCamoProgress(user);
  const newUnlocks = [];

  for (const camoId of EGG_CAMO_IDS) {
    if (progress.unlockedCamos[camoId]) continue;
    const evalResult = evaluateEggCamoUnlock(
      camoId,
      progress.lifetimeCollected,
      progress.unlockedCamos
    );
    if (!evalResult.unlocked) continue;

    const req = getEggCamoRequirement(camoId);
    progress.unlockedCamos[camoId] = true;
    progress.unlockHistory[camoId] = {
      unlockedAt: new Date(),
      accountLevelAtUnlock: accountSnapshot.accountLevelAtUnlock,
      prestigeAtUnlock: accountSnapshot.prestigeAtUnlock,
      rarityCountAtUnlock: Number(progress.lifetimeCollected?.[req?.eggTier]) || 0,
      source: unlockSource,
    };

    if (!progress.pendingUnlockCelebrations.includes(camoId)) {
      progress.pendingUnlockCelebrations.push(camoId);
    }
    newUnlocks.push(camoId);
  }

  const rows = buildEggCamoRows(progress);
  const summary = summarizeEggCamoCollection(rows);
  if (summary.mastered && !progress.collectionMastered) {
    progress.collectionMastered = true;
    progress.collectionMasteredAt = new Date();
    auditFireAndForget(EGG_CAMO_COLLECTION_MASTERED_EVENT, {
      userId: user._id,
      meta: { version: EGG_CAMO_COLLECTION_VERSION, unlocked: summary.unlocked },
    });
  }

  if (newUnlocks.length) user.markModified('eggCamoProgress');
  return newUnlocks;
}

/**
 * Record a legitimate egg acquisition toward lifetime mastery.
 * @param {import('../models/User')} user
 * @param {{ tier: string, quantity?: number, source: string, skipSave?: boolean }} opts
 * @returns {Promise<{ newUnlocks: string[], tier: string, quantity: number }|null>}
 */
async function recordLegitimateEggAcquisition(user, opts = {}) {
  const tier = String(opts.tier || '').trim();
  const quantity = Math.max(1, Number(opts.quantity) || 1);
  const source = String(opts.source || '').trim();

  if (!isHatchableEggTier(tier)) return null;
  if (!isCountableSource(source)) return null;

  const progress = ensureEggCamoProgress(user);
  progress.lifetimeCollected[tier] = Math.max(0, Number(progress.lifetimeCollected[tier]) || 0) + quantity;

  const accountSnapshot = await loadAccountSnapshot(user._id);
  const newUnlocks = evaluateAndPersistUnlocks(user, accountSnapshot, source);

  user.markModified('eggCamoProgress');
  if (!opts.skipSave) {
    await user.save();
  }

  if (tier === 'mythic') {
    try {
      const { evaluateMythicEggKeychainGrant } = require('./eggKeychainService');
      await evaluateMythicEggKeychainGrant(user, source);
    } catch (err) {
      console.error('[egg-keychains] mythic keychain grant failed', err?.message || err);
    }
  }

  return { newUnlocks, tier, quantity };
}

async function getEggCamoCollectionState(user, { backfill = true } = {}) {
  if (backfill) backfillLifetimeCollectedFromHistory(user);

  const progress = ensureEggCamoProgress(user);
  const accountSnapshot = await loadAccountSnapshot(user._id);

  const hadPending = progress.pendingUnlockCelebrations.length;
  evaluateAndPersistUnlocks(user, accountSnapshot, 'reconcile');
  if (hadPending !== progress.pendingUnlockCelebrations.length || !progress.backfilledAt) {
    user.markModified('eggCamoProgress');
    await user.save();
  }

  const rows = buildEggCamoRows(progress);
  const summary = summarizeEggCamoCollection(rows);
  const closest = getClosestEggCamo(rows);

  return {
    version: EGG_CAMO_COLLECTION_VERSION,
    summary,
    items: rows,
    lifetimeCollected: { ...progress.lifetimeCollected },
    collectionMastered: Boolean(progress.collectionMastered),
    collectionMasteredAt: progress.collectionMasteredAt
      ? new Date(progress.collectionMasteredAt).toISOString()
      : null,
    closestCamo: closest
      ? {
          id: closest.id,
          name: closest.name,
          remaining: Math.max(0, closest.target - closest.current),
          eggRarityLabel: closest.eggRarityLabel,
        }
      : null,
    pendingUnlockCelebrations: [...(progress.pendingUnlockCelebrations || [])],
  };
}

async function acknowledgeEggCamoCelebrations(user, camoIds = []) {
  const progress = ensureEggCamoProgress(user);
  const ack = new Set((Array.isArray(camoIds) ? camoIds : [camoIds]).filter(Boolean));
  if (!ack.size) {
    progress.pendingUnlockCelebrations = [];
  } else {
    progress.pendingUnlockCelebrations = progress.pendingUnlockCelebrations.filter(
      (id) => !ack.has(id)
    );
  }
  user.markModified('eggCamoProgress');
  await user.save();
  return getEggCamoCollectionState(user, { backfill: false });
}

module.exports = {
  ensureEggCamoProgress,
  recordLegitimateEggAcquisition,
  getEggCamoCollectionState,
  acknowledgeEggCamoCelebrations,
  backfillLifetimeCollectedFromHistory,
  isCountableSource,
};
