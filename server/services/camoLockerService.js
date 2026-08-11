/**
 * Savvy Camo Locker — server-authoritative unlock state.
 *
 * Deliberately built on top of the EXISTING cosmetic inventory
 * (`CosmeticInventory` + `grantSystemCosmeticUnlock`) so there is exactly one
 * reward inventory and one user identity across the Savvy Universe. Any app
 * (Final10, SavvyTrip, Ai-Go, VR) hitting `GET /api/camo-locker/me` with the
 * same token sees the same locker.
 */

const User = require('../models/User');
const CosmeticInventory = require('../models/CosmeticInventory');
const { ensureProgressDocuments } = require('./battlePassPersistenceService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const {
  CAMO_CATALOG_VERSION,
  CAMO_ITEMS,
  CAMO_CATEGORY_IDS,
  getCamoItem,
  isKnownCamoItemId,
  isValidCamoCategory,
  evaluateCamoRequirement,
} = require('../config/camoLocker');
const { isNukeCamoItemId } = require('../config/nukeCollection');
const { canAccessNukeCollection, stripNukeFromRecord } = require('./nukeAccessService');
const {
  isAdminOwnerOnlyItem,
  canViewCamoItem,
  filterCamoItemsForUser,
  assertCanViewCamoItem,
} = require('./camoVisibilityService');
const { NUKE_COLLECTION, NUKE_REQUIREMENTS } = require('../config/nukeCollection');

/** Hard ceiling on how much a single category counter can move per day. */
const DAILY_CATEGORY_CAP = 40;

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function badRequest(message, code = 'BAD_REQUEST') {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

function readCategoryCounters(inv) {
  const out = {};
  for (const id of CAMO_CATEGORY_IDS) out[id] = 0;
  const map = inv?.camoCategoryProgress;
  if (!map) return out;
  const entries = typeof map.entries === 'function' ? map.entries() : Object.entries(map);
  for (const [key, value] of entries) {
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = Math.max(0, Number(value) || 0);
    }
  }
  return out;
}

function readCamoUnlockMeta(inv) {
  const meta = {};
  for (const entry of inv?.camoUnlocks || []) {
    if (!entry?.itemId) continue;
    meta[entry.itemId] = {
      unlockedAt: entry.unlockedAt ? new Date(entry.unlockedAt).toISOString() : null,
      serialNumber: entry.serialNumber == null ? null : Number(entry.serialNumber),
      source: entry.source || 'system',
      claimedAt: entry.claimedAt ? new Date(entry.claimedAt).toISOString() : null,
      capturedProfileLevel:
        entry.capturedProfileLevel == null ? null : Number(entry.capturedProfileLevel),
      capturedPrestige: entry.capturedPrestige == null ? null : Number(entry.capturedPrestige),
      capturedEmblemId: entry.capturedEmblemId || null,
      capturedCallingCardId: entry.capturedCallingCardId || null,
      capturedUserId: entry.capturedUserId ? String(entry.capturedUserId) : null,
      capturedUsername: entry.capturedUsername || null,
    };
  }
  return meta;
}

/**
 * Real account metrics used by the secondary unlock gates. Never client input.
 * @returns {Promise<{profileLevel: number, currentStreak: number, battlePassTier: number, savvyPoints: number}>}
 */
async function loadAccountMetrics(user, bp) {
  let profileLevel = 1;
  try {
    const { getProfileProgress } = require('./profileXpService');
    const progress = await getProfileProgress(user._id);
    profileLevel = Math.max(1, Number(progress?.profileLevel) || 1);
  } catch {
    /* level service unavailable — treat as level 1 rather than failing the locker */
  }
  return {
    profileLevel,
    currentStreak: Math.max(0, Number(user?.currentStreak) || 0),
    battlePassTier: Math.max(0, Number(bp?.tier) || 0),
    savvyPoints: Math.max(0, Number(user?.savvyPoints) || 0),
  };
}

/**
 * Mint the next serial for an item. Serials are per-item and sequential, so
 * "#000127" genuinely means the 127th account to earn that exact piece.
 */
async function nextSerialNumber(itemId) {
  const count = await CosmeticInventory.countDocuments({ 'camoUnlocks.itemId': itemId });
  return count + 1;
}

function findUnlockEntry(inv, itemId) {
  return (inv.camoUnlocks || []).find((e) => e.itemId === itemId) || null;
}

/** Older inventory documents predate the camo fields — backfill in memory. */
function ensureCamoFields(inv) {
  if (!Array.isArray(inv.camoUnlocks)) inv.camoUnlocks = [];
  if (!inv.camoCategoryProgress || typeof inv.camoCategoryProgress.get !== 'function') {
    inv.camoCategoryProgress = new Map();
  }
  if (!inv.camoDailyCounters || typeof inv.camoDailyCounters.get !== 'function') {
    inv.camoDailyCounters = new Map();
  }
  return inv;
}

/**
 * Record the unlock metadata row for a camo the user just earned.
 * Idempotent: an existing row is left untouched (serial never changes).
 */
async function ensureUnlockMetadata(inv, itemId, source, capture = {}) {
  if (findUnlockEntry(inv, itemId)) return false;
  const serialNumber = await nextSerialNumber(itemId);
  const row = {
    itemId,
    unlockedAt: new Date(),
    serialNumber,
    source: String(source || 'system').slice(0, 64),
    claimedAt: null,
  };
  if (capture.profileLevel != null) row.capturedProfileLevel = capture.profileLevel;
  if (capture.prestige != null) row.capturedPrestige = capture.prestige;
  if (capture.emblemId) row.capturedEmblemId = capture.emblemId;
  if (capture.callingCardId) row.capturedCallingCardId = capture.callingCardId;
  if (capture.userId) row.capturedUserId = capture.userId;
  if (capture.username) row.capturedUsername = String(capture.username).slice(0, 64);
  inv.camoUnlocks.push(row);
  return true;
}

/**
 * Grant one camo. Writes through the shared cosmetic unlock path so the item
 * shows up everywhere cosmetics already show up, then stamps camo metadata.
 * @returns {Promise<boolean>} true when newly unlocked
 */
async function grantCamoUnlock(userId, itemId, source = 'camo_locker') {
  if (!isKnownCamoItemId(itemId)) throw badRequest('Unknown camo item', 'UNKNOWN_CAMO');
  const isNew = await grantSystemCosmeticUnlock(userId, itemId, source);
  const user = await User.findById(userId).select('username emblemId callingCardId');
  const { inv, bp } = await ensureProgressDocuments(userId);
  ensureCamoFields(inv);
  let capture = {};
  const catalogItem = getCamoItem(itemId);
  if (isAdminOwnerOnlyItem(itemId) || catalogItem?.captureAtUnlock) {
    const metrics = await loadAccountMetrics(user, bp);
    let prestige = 0;
    try {
      const { getProfileProgress } = require('./profileXpService');
      const progress = await getProfileProgress(userId);
      prestige = Math.max(0, Number(progress?.prestige) || 0);
    } catch {
      /* prestige optional */
    }
    capture = {
      profileLevel: metrics.profileLevel,
      prestige,
      emblemId: user?.emblemId || null,
      callingCardId: user?.callingCardId || null,
      userId: String(userId),
      username: user?.username || '',
    };
  }
  const added = await ensureUnlockMetadata(inv, itemId, source, capture);
  if (added) await inv.save();
  return isNew || added;
}

/**
 * Re-check every camo against current counters + metrics and grant anything
 * that has been earned. Safe to call often — already-unlocked items no-op.
 * @returns {Promise<string[]>} newly unlocked item IDs
 */
async function evaluateCamoUnlocks(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) return [];
  const { inv, bp } = await ensureProgressDocuments(userId);
  const counters = readCategoryCounters(inv);
  const metrics = await loadAccountMetrics(user, bp);
  const owned = new Set(inv.unlockedItemIds || []);

  const newlyUnlocked = [];
  for (const item of CAMO_ITEMS) {
    if (isNukeCamoItemId(item.id)) continue;
    if (item.grantOnly || isAdminOwnerOnlyItem(item)) continue;
    if (owned.has(item.id)) continue;
    const result = evaluateCamoRequirement(item, {
      categoryCount: counters[item.category] || 0,
      metrics,
    });
    if (result.requirementsMet) newlyUnlocked.push(item.id);
  }

  for (const itemId of newlyUnlocked) {
    await grantCamoUnlock(userId, itemId, 'camo_progress');
  }
  try {
    const { evaluateMasterClassifiedUnlocks } = require('./masterClassifiedService');
    await evaluateMasterClassifiedUnlocks(userId);
  } catch (err) {
    console.warn('[camoLocker] master classified evaluation failed:', err?.message || err);
  }
  return newlyUnlocked;
}

/**
 * Increment a category activity counter, then evaluate unlocks.
 * The client can only signal that an action happened; the amount, the cap and
 * the resulting unlocks are all decided here.
 * @param {string} userId
 * @param {string} category camo category ID
 * @param {number} [increment]
 */
async function recordCamoCategoryProgress(userId, category, increment = 1) {
  if (!isValidCamoCategory(category)) throw badRequest('Unknown camo category', 'UNKNOWN_CATEGORY');
  const step = Math.max(1, Math.min(5, Math.round(Number(increment) || 1)));

  const { inv } = await ensureProgressDocuments(userId);
  ensureCamoFields(inv);
  const day = todayKey();
  const daily = inv.camoDailyCounters?.get(category);
  const usedToday = daily && daily.day === day ? Math.max(0, Number(daily.count) || 0) : 0;
  const allowed = Math.max(0, DAILY_CATEGORY_CAP - usedToday);
  const applied = Math.min(step, allowed);

  if (applied > 0) {
    const current = Math.max(0, Number(inv.camoCategoryProgress.get(category)) || 0);
    inv.camoCategoryProgress.set(category, current + applied);
    inv.camoDailyCounters.set(category, { day, count: usedToday + applied });
    await inv.save();
  }

  const unlocked = applied > 0 ? await evaluateCamoUnlocks(userId) : [];
  const state = await getCamoLockerForUser(userId);
  return { applied, cappedForToday: applied < step, unlocked, state };
}

/**
 * Full locker payload. Contains only unlock truth + progress — presentation
 * (images, copy, layout) lives in each client's catalog config.
 */
async function getCamoLockerForUser(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const { inv, bp } = await ensureProgressDocuments(userId);
  const counters = readCategoryCounters(inv);
  const metrics = await loadAccountMetrics(user, bp);
  const unlockMeta = readCamoUnlockMeta(inv);
  const owned = new Set(inv.unlockedItemIds || []);
  const { buildDealStreakStatus } = require('./dealStreakService');
  const dealStreakStatus = buildDealStreakStatus(user);
  const nukeChallengeProgressByCategory = new Map(
    (dealStreakStatus.nuke?.challenges || []).map((challenge) => [
      challenge.category,
      challenge,
    ])
  );

  const visibleItems = filterCamoItemsForUser(
    CAMO_ITEMS.filter((item) => !isNukeCamoItemId(item.id)),
    user
  );

  const items = visibleItems.map((item) => {
    const unlocked = owned.has(item.id);
    const nukeChallenge = item.nukeCategoryChallenge
      ? nukeChallengeProgressByCategory.get(item.category) || null
      : null;
    const requirement = evaluateCamoRequirement(item, {
      categoryCount: counters[item.category] || 0,
      metrics,
      unlocked,
      nukeChallengeProgress: nukeChallenge?.progress ?? 0,
    });
    const meta = unlockMeta[item.id] || null;
    return {
      id: item.id,
      unlocked,
      progress: unlocked ? 100 : requirement.progress,
      current: unlocked ? requirement.target : requirement.current,
      target: requirement.target,
      gateStatus: requirement.gateStatus,
      gatesMet: requirement.gatesMet,
      unlockedAt: meta?.unlockedAt || null,
      serialNumber: meta?.serialNumber ?? null,
      claimedAt: meta?.claimedAt || null,
      capturedProfileLevel: meta?.capturedProfileLevel ?? null,
      capturedPrestige: meta?.capturedPrestige ?? null,
      capturedEmblemId: meta?.capturedEmblemId || null,
      capturedCallingCardId: meta?.capturedCallingCardId || null,
      capturedUserId: meta?.capturedUserId || null,
      capturedUsername: meta?.capturedUsername || null,
    };
  });

  const visibleIdSet = new Set(visibleItems.map((i) => i.id));

  return {
    catalogVersion: CAMO_CATALOG_VERSION,
    userId: String(user._id),
    username: user.username || '',
    savvyPoints: metrics.savvyPoints,
    profileLevel: metrics.profileLevel,
    currentStreak: metrics.currentStreak,
    battlePassTier: metrics.battlePassTier,
    categoryProgress: stripNukeFromRecord(counters),
    unlockedCamoIds: items.filter((i) => i.unlocked).map((i) => i.id),
    newCamoIds: (inv.newItemIds || []).filter(
      (id) => visibleIdSet.has(id) && isKnownCamoItemId(id) && !isNukeCamoItemId(id)
    ),
    items,
    nukePreviewAccess: canAccessNukeCollection(user),
    privateRewardsAccess: canAccessNukeCollection(user),
  };
}

/** Clear the NEW ribbon for camo items (delegates to the shared newItemIds list). */
async function markCamosSeen(userId, itemIds) {
  const user = await User.findById(userId).select('-password');
  const ids = (Array.isArray(itemIds) ? itemIds : []).filter(
    (id) => isKnownCamoItemId(id) && canViewCamoItem(user, id)
  );
  if (!ids.length) return getCamoLockerForUser(userId);
  const { inv } = await ensureProgressDocuments(userId);
  const drop = new Set(ids);
  inv.newItemIds = (inv.newItemIds || []).filter((id) => !drop.has(id));
  await inv.save();
  return getCamoLockerForUser(userId);
}

/**
 * Mark an unlocked camo as claimed. No purchase/shipping logic — this only
 * records intent so a future fulfilment system has a hook.
 */
async function claimCamoReward(userId, itemId) {
  if (!isKnownCamoItemId(itemId)) throw badRequest('Unknown camo item', 'UNKNOWN_CAMO');
  const user = await User.findById(userId).select('-password');
  assertCanViewCamoItem(user, itemId);
  const { inv } = await ensureProgressDocuments(userId);
  if (!(inv.unlockedItemIds || []).includes(itemId)) {
    const err = new Error('Camo is not unlocked');
    err.status = 403;
    err.code = 'CAMO_LOCKED';
    throw err;
  }
  ensureCamoFields(inv);
  let entry = findUnlockEntry(inv, itemId);
  if (!entry) {
    // Unlocked through a legacy cosmetic grant before camo metadata existed.
    await ensureUnlockMetadata(inv, itemId, 'backfill');
    entry = findUnlockEntry(inv, itemId);
  }
  if (entry && !entry.claimedAt) {
    entry.claimedAt = new Date();
    await inv.save();
  }
  return getCamoLockerForUser(userId);
}

/**
 * Founder/admin Nuke Collection preview — read-only shell, no ownership side effects.
 */
async function getNukeCollectionPreview(user) {
  if (!canAccessNukeCollection(user)) {
    const err = new Error('Not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return {
    previewMode: true,
    collection: NUKE_COLLECTION,
    requirements: NUKE_REQUIREMENTS,
    items: [],
    plannedRewardTypes: NUKE_COLLECTION.plannedRewardTypes,
    message:
      'Preview only — no rewards populated yet. Preview does not grant ownership or serial numbers.',
  };
}

module.exports = {
  DAILY_CATEGORY_CAP,
  getCamoLockerForUser,
  getNukeCollectionPreview,
  recordCamoCategoryProgress,
  evaluateCamoUnlocks,
  grantCamoUnlock,
  claimCamoReward,
  markCamosSeen,
  getCamoItem,
};
