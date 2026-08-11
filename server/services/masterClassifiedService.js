/**
 * Classified / Master Collection — server-authoritative progression + grants.
 *
 * Eligibility derives from existing Camo Locker unlock IDs only — never client input.
 */

const User = require('../models/User');
const CosmeticInventory = require('../models/CosmeticInventory');
const { ensureProgressDocuments } = require('./battlePassPersistenceService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const {
  MASTER_CLASSIFIED_VERSION,
  MASTER_CLASSIFIED_COLLECTION,
  MASTER_CLASSIFIED_ITEMS,
  MASTER_CLASSIFIED_ITEM_IDS,
  MASTER_CLASSIFIED_HERO_ASSET,
  MASTER_CLASSIFIED_TIER,
  MASTER_SAVVY_BONUS_FRACTION,
  MASTER_BONUS_EMBLEM_ID,
  MASTER_BONUS_CALLING_CARD_ID,
  MASTER_BONUS_LOBBY_ANIM_ID,
  MASTER_SHOE_TICKET_STATES,
  isMasterClassifiedEligible,
  summarizeMasterClassifiedCollection,
} = require('../config/masterClassifiedCollection');
const { auditFireAndForget } = require('./securityAuditService');
const { isFounderAdminEmail } = require('../lib/founderAdminAccess');

const OPERATOR_RANKS = [
  { id: 'recruit', label: 'Recruit', minLevel: 1 },
  { id: 'scout', label: 'Scout', minLevel: 5 },
  { id: 'operator', label: 'Operator', minLevel: 10 },
  { id: 'specialist', label: 'Specialist', minLevel: 20 },
  { id: 'elite', label: 'Elite Operator', minLevel: 30 },
  { id: 'apex', label: 'Apex Operator', minLevel: 45 },
];

function getOperatorRank(profileLevel) {
  const level = Math.max(1, Number(profileLevel) || 1);
  let rank = OPERATOR_RANKS[0];
  for (const candidate of OPERATOR_RANKS) {
    if (level >= candidate.minLevel) rank = candidate;
  }
  return rank;
}

/** Admin-only Classified asset preview — mirrors requireAdminAccess gate (404 for everyone else). */
function canAccessClassifiedAdminPreview(user) {
  if (!user) return false;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin' || role === 'superadmin') return true;
  if (typeof user.isAdmin === 'function' && user.isAdmin()) return true;
  if (typeof user.isSuperAdmin === 'function' && user.isSuperAdmin()) return true;
  return isFounderAdminEmail(user.email);
}

function denyClassifiedAdminPreviewNotFound() {
  const err = new Error('Not found');
  err.status = 404;
  err.code = 'NOT_FOUND';
  return err;
}

function ensureMasterProgress(user) {
  if (!user.masterClassifiedProgress) {
    user.masterClassifiedProgress = {
      collectionMastered: false,
      collectionMasteredAt: null,
      collectionSerialNumber: null,
      savvyBonusGranted: false,
      shoeTicketState: 'LOCKED',
      unlockSnapshot: null,
      completionData: null,
    };
  }
  const p = user.masterClassifiedProgress;
  if (p.collectionMastered == null) p.collectionMastered = false;
  if (!MASTER_SHOE_TICKET_STATES.includes(p.shoeTicketState)) p.shoeTicketState = 'LOCKED';
  if (!p.unlockSnapshot || typeof p.unlockSnapshot !== 'object') p.unlockSnapshot = null;
  return p;
}

function ensureCamoFields(inv) {
  if (!Array.isArray(inv.camoUnlocks)) inv.camoUnlocks = [];
  return inv;
}

function findUnlockEntry(inv, itemId) {
  return (inv.camoUnlocks || []).find((e) => e.itemId === itemId) || null;
}

async function nextSerialNumber(itemId) {
  const count = await CosmeticInventory.countDocuments({ 'camoUnlocks.itemId': itemId });
  return count + 1;
}

async function nextCollectionSerialNumber() {
  const count = await User.countDocuments({
    'masterClassifiedProgress.collectionSerialNumber': { $ne: null },
  });
  return count + 1;
}

async function loadAccountSnapshot(userId, user) {
  let accountLevelAtUnlock = 1;
  let prestigeAtUnlock = 0;
  let rankAtUnlock = 'Recruit';
  try {
    const { getProfileProgress } = require('./profileXpService');
    const progress = await getProfileProgress(userId);
    accountLevelAtUnlock = Math.max(1, Number(progress?.profileLevel ?? progress?.level) || 1);
    prestigeAtUnlock = Math.max(0, Number(progress?.prestige) || 0);
    rankAtUnlock = getOperatorRank(accountLevelAtUnlock).label;
  } catch {
    /* non-fatal */
  }
  return {
    accountLevelAtUnlock,
    prestigeAtUnlock,
    rankAtUnlock,
    emblemId: user?.emblemId || null,
    callingCardId: user?.callingCardId || null,
    username: user?.username || '',
    userId: String(userId),
  };
}

async function ensureMasterUnlockMetadata(inv, itemId, source, capture = {}) {
  if (findUnlockEntry(inv, itemId)) return false;
  const serialNumber = await nextSerialNumber(itemId);
  const row = {
    itemId,
    unlockedAt: new Date(),
    serialNumber,
    source: String(source || 'master_classified').slice(0, 64),
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

function readMasterUnlockMeta(inv) {
  const meta = {};
  for (const itemId of MASTER_CLASSIFIED_ITEM_IDS) {
    const entry = findUnlockEntry(inv, itemId);
    if (!entry) continue;
    meta[itemId] = {
      unlockedAt: entry.unlockedAt ? new Date(entry.unlockedAt).toISOString() : null,
      serialNumber: entry.serialNumber == null ? null : Number(entry.serialNumber),
      source: entry.source || 'master_classified',
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

function resolveShoeTicketState(progress, itemUnlocked) {
  if (!itemUnlocked) return 'LOCKED';
  const stored = progress?.shoeTicketState;
  if (stored && stored !== 'LOCKED' && MASTER_SHOE_TICKET_STATES.includes(stored)) return stored;
  return 'EARNED';
}

async function grantMasterBonusCosmetics(userId) {
  const ids = [
    MASTER_BONUS_EMBLEM_ID,
    MASTER_BONUS_CALLING_CARD_ID,
    MASTER_BONUS_LOBBY_ANIM_ID,
  ];
  for (const id of ids) {
    await grantSystemCosmeticUnlock(userId, id, 'master_classified_bonus');
  }
}

async function applySavvyBonus(user) {
  const progress = ensureMasterProgress(user);
  if (progress.savvyBonusGranted) return false;
  user.powerMultiplierBonus =
    Math.round(
      ((Number(user.powerMultiplierBonus) || 0) + MASTER_SAVVY_BONUS_FRACTION) * 100
    ) / 100;
  progress.savvyBonusGranted = true;
  user.markModified('masterClassifiedProgress');
  return true;
}

/**
 * Evaluate camo mastery and grant Master Collection when eligible.
 * Safe to call after every camo unlock evaluation.
 * @returns {Promise<{ newlyMastered: boolean, grantedItemIds: string[] }>}
 */
async function evaluateMasterClassifiedUnlocks(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) return { newlyMastered: false, grantedItemIds: [] };

  const { inv } = await ensureProgressDocuments(userId);
  ensureCamoFields(inv);
  const camoUnlockedIds = inv.unlockedItemIds || [];

  if (!isMasterClassifiedEligible(camoUnlockedIds)) {
    return { newlyMastered: false, grantedItemIds: [] };
  }

  const progress = ensureMasterProgress(user);
  if (progress.collectionMastered) {
    return { newlyMastered: false, grantedItemIds: [] };
  }

  const snapshot = await loadAccountSnapshot(userId, user);
  const collectionSerial = await nextCollectionSerialNumber();
  const camoRows = summarizeMasterClassifiedCollection({ camoUnlockedIds }).camoRows;

  progress.collectionMastered = true;
  progress.collectionMasteredAt = new Date();
  progress.collectionSerialNumber = collectionSerial;
  progress.shoeTicketState = 'EARNED';
  progress.unlockSnapshot = {
    userId: snapshot.userId,
    username: snapshot.username,
    accountLevelAtUnlock: snapshot.accountLevelAtUnlock,
    prestigeAtUnlock: snapshot.prestigeAtUnlock,
    rankAtUnlock: snapshot.rankAtUnlock,
    emblemIdAtUnlock: snapshot.emblemId,
    callingCardIdAtUnlock: snapshot.callingCardId,
    masterSerial: collectionSerial,
    unlockedAt: progress.collectionMasteredAt.toISOString(),
    source: 'camo_locker_mastery',
  };
  progress.completionData = {
    camoFamilies: camoRows.map((row) => ({
      camoId: row.camoId,
      unlocked: row.unlocked,
      total: row.total,
      complete: row.complete,
    })),
    version: MASTER_CLASSIFIED_VERSION,
  };
  user.markModified('masterClassifiedProgress');

  const capture = {
    profileLevel: snapshot.accountLevelAtUnlock,
    prestige: snapshot.prestigeAtUnlock,
    emblemId: snapshot.emblemId,
    callingCardId: snapshot.callingCardId,
    userId: snapshot.userId,
    username: snapshot.username,
  };

  const grantedItemIds = [];
  for (const item of MASTER_CLASSIFIED_ITEMS) {
    const isNew = await grantSystemCosmeticUnlock(userId, item.id, 'master_classified');
    const added = await ensureMasterUnlockMetadata(inv, item.id, 'master_classified', capture);
    if (isNew || added) grantedItemIds.push(item.id);
  }

  await grantMasterBonusCosmetics(userId);
  await applySavvyBonus(user);
  await inv.save();
  await user.save();

  auditFireAndForget('MASTER_CLASSIFIED_COLLECTION_MASTERED', {
    userId,
    meta: {
      version: MASTER_CLASSIFIED_VERSION,
      collectionSerial,
      grantedCount: grantedItemIds.length,
    },
  });

  return { newlyMastered: true, grantedItemIds };
}

/**
 * Full payload for Classified Collection UI.
 */
async function getMasterClassifiedForUser(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const { inv } = await ensureProgressDocuments(userId);
  ensureCamoFields(inv);
  const progress = ensureMasterProgress(user);
  const camoUnlockedIds = inv.unlockedItemIds || [];
  const owned = new Set(camoUnlockedIds);
  const masterUnlockedIds = MASTER_CLASSIFIED_ITEM_IDS.filter((id) => owned.has(id));
  const summary = summarizeMasterClassifiedCollection({ camoUnlockedIds, masterUnlockedIds });
  const unlockMeta = readMasterUnlockMeta(inv);
  const revealRewards = summary.eligible || summary.mastered;

  const items = MASTER_CLASSIFIED_ITEMS.map((def) => {
    const unlocked = owned.has(def.id);
    const meta = unlockMeta[def.id] || null;
    const showAsset = revealRewards || def.previewWhenLocked;
    const base = {
      id: def.id,
      slug: def.slug,
      name: def.name,
      shortName: def.shortName,
      kind: def.kind || 'apparel',
      assetPath: showAsset ? def.assetPath : null,
      collection: def.collection || 'classified',
      tier: def.tier || MASTER_CLASSIFIED_TIER,
      camo: def.camo || null,
      camoName: def.camoName || null,
      tagline: def.tagline || null,
      earnedNotBought: Boolean(def.earnedNotBought),
      previewWhenLocked: Boolean(def.previewWhenLocked),
      showcaseArtwork: Boolean(def.showcaseArtwork),
      unlockRequirementLabel: def.unlockRequirementLabel || 'CLASSIFIED REQUIREMENT',
      associatedRewards: def.associatedRewards || null,
      unlocked,
      serialNumber: meta?.serialNumber ?? null,
      unlockedAt: meta?.unlockedAt || null,
      capturedProfileLevel: meta?.capturedProfileLevel ?? null,
      capturedPrestige: meta?.capturedPrestige ?? null,
      capturedEmblemId: meta?.capturedEmblemId || null,
      capturedCallingCardId: meta?.capturedCallingCardId || null,
      capturedUsername: meta?.capturedUsername || null,
    };
    if (def.kind === 'shoe_ticket') {
      base.shoeTicketState = resolveShoeTicketState(progress, unlocked);
      base.shoeTicketCopy = MASTER_CLASSIFIED_COLLECTION.shoeTicketCopy;
      base.shoeTicketDisclaimer = MASTER_CLASSIFIED_COLLECTION.shoeTicketDisclaimer;
      base.masterCollectionSerialNumber = progress.collectionSerialNumber ?? null;
    }
    return base;
  });

  return {
    version: MASTER_CLASSIFIED_VERSION,
    collection: MASTER_CLASSIFIED_COLLECTION,
    summary,
    items,
    revealRewards,
    collectionSerialNumber: progress.collectionSerialNumber,
    unlockSnapshot: progress.unlockSnapshot,
    completionData: progress.completionData,
    savvyBonusGranted: Boolean(progress.savvyBonusGranted),
    shoeTicketState: progress.shoeTicketState,
    bonusEmblemId: MASTER_BONUS_EMBLEM_ID,
    bonusCallingCardId: MASTER_BONUS_CALLING_CARD_ID,
    bonusLobbyAnimId: MASTER_BONUS_LOBBY_ANIM_ID,
    adminPreviewAccess: canAccessClassifiedAdminPreview(user),
  };
}

/**
 * Read-only admin preview of every uploaded Classified Master asset.
 * Never grants, unlocks, or mutates progression.
 */
async function getMasterClassifiedAdminPreview(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user || !canAccessClassifiedAdminPreview(user)) {
    throw denyClassifiedAdminPreviewNotFound();
  }

  const base = await getMasterClassifiedForUser(userId);

  const items = MASTER_CLASSIFIED_ITEMS.map((def) => {
    const row = base.items.find((i) => i.id === def.id);
    return {
      id: def.id,
      slug: def.slug,
      name: def.name,
      shortName: def.shortName,
      kind: def.kind || 'apparel',
      rewardTypeName: def.shortName,
      categoryName: 'CLASSIFIED MASTER',
      assetPath: def.assetPath,
      assetKey: def.slug,
      imageUrl: def.assetPath,
      previewImageUrl: def.assetPath,
      adminPreview: true,
      owned: Boolean(row?.unlocked),
      collectionStatus: base.summary?.mastered ? 'MASTERED' : 'LOCKED / NOT EARNED',
    };
  });

  return {
    previewMode: true,
    adminPreview: true,
    message: 'ADMIN PREVIEW ONLY — No rewards are being unlocked.',
    unlockRequirement: 'Complete all six camo families to declassify Master rewards.',
    collection: base.collection,
    summary: base.summary,
    items,
    heroAsset: MASTER_CLASSIFIED_HERO_ASSET,
  };
}

module.exports = {
  evaluateMasterClassifiedUnlocks,
  getMasterClassifiedForUser,
  getMasterClassifiedAdminPreview,
  canAccessClassifiedAdminPreview,
};
