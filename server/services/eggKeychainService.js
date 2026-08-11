/**
 * Egg Keychain Collection — server-authoritative unlocks, serials, and history.
 *
 * Built on CosmeticInventory.camoUnlocks (same path as Camo Locker) so serial
 * minting stays sequential and immutable. Does NOT touch Mythic Egg hatch rewards.
 */

const User = require('../models/User');
const CosmeticInventory = require('../models/CosmeticInventory');
const { ensureProgressDocuments } = require('./battlePassPersistenceService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const {
  EGG_KEYCHAIN_COLLECTION_VERSION,
  EGG_KEYCHAIN_COLLECTION,
  EGG_KEYCHAIN_ITEMS,
  MYTHIC_EGG_KEYCHAIN_ITEM_ID,
  NUKE_EGG_KEYCHAIN_ITEM_ID,
  QUANTUM_EGG_KEYCHAIN_ITEM_ID,
  getEggKeychainItem,
  isEggKeychainItemId,
  isMythicEggKeychainEligible,
  isNukeEggKeychainEligible,
  formatKeychainSerial,
} = require('../config/eggKeychainCollection');
const { auditFireAndForget } = require('./securityAuditService');

function eggCamoHelpers() {
  return require('./eggCamoProgressService');
}

function readNukeDoc(user) {
  return user?.perkMachine?.nuke || null;
}

function earnedThroughLabel(item, meta) {
  if (item?.quantumLegacy) return 'Quantum Legacy';
  if (item?.nukeCollection) return 'Nuke Egg Rewards';
  return 'Final10';
}

function quantumHelpers() {
  return require('./quantumEggService');
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

async function loadAccountSnapshot(userId, user) {
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
  return {
    profileLevel,
    prestige,
    emblemId: user?.emblemId || null,
    callingCardId: user?.callingCardId || null,
    username: user?.username || '',
    userId: String(userId),
  };
}

function readKeychainUnlockMeta(inv) {
  const meta = {};
  for (const item of EGG_KEYCHAIN_ITEMS) {
    const entry = findUnlockEntry(inv, item.id);
    if (!entry) continue;
    meta[item.id] = {
      unlockedAt: entry.unlockedAt ? new Date(entry.unlockedAt).toISOString() : null,
      serialNumber: entry.serialNumber == null ? null : Number(entry.serialNumber),
      source: entry.source || 'egg_keychain',
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

async function ensureKeychainUnlockMetadata(inv, itemId, source, capture = {}) {
  if (findUnlockEntry(inv, itemId)) return false;
  const serialNumber = await nextSerialNumber(itemId);
  const row = {
    itemId,
    unlockedAt: new Date(),
    serialNumber,
    source: String(source || 'egg_keychain').slice(0, 64),
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
 * Grant a keychain collectible. Idempotent — duplicate grants are ignored.
 * @returns {Promise<{ granted: boolean, serialNumber: number|null }>}
 */
async function grantEggKeychainUnlock(userId, itemId, source = 'egg_keychain', capture = {}) {
  if (!isEggKeychainItemId(itemId)) {
    const err = new Error('Unknown egg keychain item');
    err.status = 400;
    err.code = 'UNKNOWN_KEYCHAIN';
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const { inv } = await ensureProgressDocuments(userId);
  ensureCamoFields(inv);

  const existing = findUnlockEntry(inv, itemId);
  if (existing) {
    return {
      granted: false,
      serialNumber: existing.serialNumber == null ? null : Number(existing.serialNumber),
    };
  }

  const snapshot = await loadAccountSnapshot(userId, user);
  const mergedCapture = {
    profileLevel: capture.profileLevel ?? snapshot.profileLevel,
    prestige: capture.prestige ?? snapshot.prestige,
    emblemId: capture.emblemId ?? snapshot.emblemId,
    callingCardId: capture.callingCardId ?? snapshot.callingCardId,
    userId: capture.userId ?? snapshot.userId,
    username: capture.username ?? snapshot.username,
  };

  await grantSystemCosmeticUnlock(userId, itemId, source);
  const { inv: freshInv } = await ensureProgressDocuments(userId);
  ensureCamoFields(freshInv);
  const added = await ensureKeychainUnlockMetadata(freshInv, itemId, source, mergedCapture);
  if (added) {
    await freshInv.save();
    auditFireAndForget('EGG_KEYCHAIN_GRANTED', {
      userId,
      meta: {
        itemId,
        source: String(source || 'egg_keychain').slice(0, 64),
        serialNumber: findUnlockEntry(freshInv, itemId)?.serialNumber ?? null,
      },
    });
  }

  const entry = findUnlockEntry(freshInv, itemId);
  return {
    granted: added,
    serialNumber: entry?.serialNumber == null ? null : Number(entry.serialNumber),
  };
}

async function evaluateNukeEggKeychainGrant(user, source = 'nuke_event_activation') {
  if (!isNukeEggKeychainEligible(readNukeDoc(user))) return false;

  const { inv } = await ensureProgressDocuments(user._id);
  ensureCamoFields(inv);
  if (findUnlockEntry(inv, NUKE_EGG_KEYCHAIN_ITEM_ID)) return false;

  const result = await grantEggKeychainUnlock(user._id, NUKE_EGG_KEYCHAIN_ITEM_ID, source);
  return result.granted;
}

async function evaluateQuantumEggKeychainGrant(user, source = 'quantum_legacy') {
  const { isQuantumEggKeychainEligible } = quantumHelpers();
  if (!isQuantumEggKeychainEligible(user)) return false;

  const { inv } = await ensureProgressDocuments(user._id);
  ensureCamoFields(inv);
  if (findUnlockEntry(inv, QUANTUM_EGG_KEYCHAIN_ITEM_ID)) return false;

  const result = await grantEggKeychainUnlock(user._id, QUANTUM_EGG_KEYCHAIN_ITEM_ID, source);
  return result.granted;
}

/**
 * Evaluate mythic egg keychain grant after egg acquisition or on reconcile.
 * @param {import('../models/User')} user
 * @param {string} source
 * @returns {Promise<boolean>} true when newly granted
 */
async function evaluateMythicEggKeychainGrant(user, source = 'egg_acquisition') {
  const { backfillLifetimeCollectedFromHistory, ensureEggCamoProgress } = eggCamoHelpers();
  backfillLifetimeCollectedFromHistory(user);
  const progress = ensureEggCamoProgress(user);
  if (!isMythicEggKeychainEligible(progress.lifetimeCollected)) return false;

  const { inv } = await ensureProgressDocuments(user._id);
  ensureCamoFields(inv);
  if (findUnlockEntry(inv, MYTHIC_EGG_KEYCHAIN_ITEM_ID)) return false;

  const result = await grantEggKeychainUnlock(user._id, MYTHIC_EGG_KEYCHAIN_ITEM_ID, source);
  return result.granted;
}

function buildKeychainHistoryRow(item, meta, unlocked, quantumLegacy = null) {
  const serial = meta?.serialNumber != null ? formatKeychainSerial(meta.serialNumber) : null;
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    displayName: item.displayName,
    rarity: item.rarity,
    tier: item.tier || item.rarity,
    collection: item.collection,
    nukeCollection: Boolean(item.nukeCollection),
    quantumLegacy: Boolean(item.quantumLegacy),
    universal: Boolean(item.universal),
    crossApp: Boolean(item.crossApp),
    hiddenUntilDiscovered: Boolean(item.hiddenUntilDiscovered),
    collectionLabel: item.collectionLabel || null,
    assetPath: item.assetPath,
    physicalCollectible: item.physicalCollectible,
    serialNumberSupported: item.serialNumberSupported,
    streamHouseEligible: item.streamHouseEligible,
    streamHouseRarity: item.streamHouseRarity,
    streamHouseTier: item.streamHouseTier || item.streamHouseRarity,
    previewWhenLocked: item.previewWhenLocked,
    earnedNotBought: item.earnedNotBought,
    earnedOnly: item.earnedOnly,
    purchasable: item.purchasable !== true,
    associatedRewards: item.associatedRewards,
    unlockRule: item.unlockRule,
    acquiredLabel: item.acquiredLabel || `${item.name} ACQUIRED`,
    tagline: item.tagline || null,
    secondaryTagline: item.secondaryTagline || null,
    lockedPreviewNote: item.lockedPreviewNote || null,
    classifiedUi: item.classifiedUi || null,
    unlocked,
    locked: !unlocked,
    serialNumber: meta?.serialNumber ?? null,
    serialLabel: serial ? `${item.name} #${serial}` : null,
    keychainHistory: unlocked
      ? {
          levelAtUnlock: meta?.capturedProfileLevel ?? quantumLegacy?.profileLevelAtUnlock ?? null,
          prestigeAtUnlock: meta?.capturedPrestige ?? quantumLegacy?.prestigeAtUnlock ?? null,
          earnedThrough: earnedThroughLabel(item, meta),
          unlockSource: meta?.source || null,
          nukeStatus: item.nukeCollection ? 'NUKE SPECIALIST' : null,
          quantumStatus: item.quantumLegacy ? 'QUANTUM LEGACY' : null,
          achievementId: quantumLegacy?.achievementId || null,
          originatingApp: quantumLegacy?.originatingApp || null,
          unlockedOn: meta?.unlockedAt || (quantumLegacy?.unlockedAt ? new Date(quantumLegacy.unlockedAt).toISOString() : null),
          emblemId: meta?.capturedEmblemId || null,
          callingCardId: meta?.capturedCallingCardId || null,
          username: meta?.capturedUsername || null,
        }
      : null,
  };
}

function sanitizeKeychainRowForClient(row, item, { adminPreview = false } = {}) {
  if (!item?.hiddenUntilDiscovered || row.unlocked) return row;

  if (adminPreview) {
    return {
      ...row,
      classified: true,
      adminPreview: true,
      previewWhenLocked: true,
      lockedBadge: item.classifiedUi?.badge || 'CLASSIFIED',
    };
  }

  const classified = item.classifiedUi || {};
  return {
    id: item.id,
    slug: item.slug,
    name: classified.name || '???',
    displayName: classified.displayName || 'CLASSIFIED',
    rarity: item.rarity,
    tier: item.tier || item.rarity,
    collection: item.collection,
    quantumLegacy: true,
    universal: true,
    crossApp: true,
    hiddenUntilDiscovered: true,
    classified: true,
    hidden: true,
    collectionLabel: item.collectionLabel || 'QUANTUM LEGACY',
    locked: true,
    unlocked: false,
    purchasable: false,
    previewWhenLocked: false,
    imageUrl: null,
    assetPath: null,
    unlockRule: {
      lockedRequirementLabel: classified.lockedRequirementLabel || 'HIDDEN LEGACY',
      classifiedLabel: 'UNKNOWN REQUIREMENT',
    },
    lockedBadge: classified.badge || 'CLASSIFIED',
    streamHouseEligible: false,
  };
}

async function getEggKeychainCollectionState(user, { reconcile = true } = {}) {
  const { backfillLifetimeCollectedFromHistory, ensureEggCamoProgress } = eggCamoHelpers();
  const {
    canAccessQuantumAdminPreview,
    ensureQuantumLegacy,
    buildQuantumPublicState,
    isQuantumEggKeychainEligible,
    isQuantumDealStreakEligible,
    evaluateQuantumEggUnlock,
  } = quantumHelpers();

  backfillLifetimeCollectedFromHistory(user);
  const progress = ensureEggCamoProgress(user);
  let quantumLegacy = ensureQuantumLegacy(user);
  const adminPreview = canAccessQuantumAdminPreview(user);
  const mythicEligible = isMythicEggKeychainEligible(progress.lifetimeCollected);
  const nukeEligible = isNukeEggKeychainEligible(readNukeDoc(user));

  if (reconcile) {
    const currentStreak = Math.max(0, Number(user.dealStreak?.currentDealStreak) || 0);
    if (isQuantumDealStreakEligible(currentStreak) && !quantumLegacy.unlocked) {
      await evaluateQuantumEggUnlock(user, 'reconcile');
      await user.save();
      quantumLegacy = ensureQuantumLegacy(user);
    }
    if (mythicEligible) {
      const granted = await evaluateMythicEggKeychainGrant(user, 'reconcile');
      if (granted) {
        user.markModified('eggCamoProgress');
        await user.save();
      }
    }
    if (nukeEligible) {
      await evaluateNukeEggKeychainGrant(user, 'reconcile');
    }
    if (isQuantumEggKeychainEligible(user)) {
      await evaluateQuantumEggKeychainGrant(user, 'reconcile');
    }
  }

  const { inv } = await ensureProgressDocuments(user._id);
  ensureCamoFields(inv);
  const metaById = readKeychainUnlockMeta(inv);

  const items = EGG_KEYCHAIN_ITEMS.map((item) => {
    const meta = metaById[item.id] || null;
    const unlocked = Boolean(meta?.unlockedAt);
    const row = buildKeychainHistoryRow(item, meta, unlocked, quantumLegacy);
    const sanitized = sanitizeKeychainRowForClient(row, item, { adminPreview });
    if ((sanitized.unlocked || sanitized.previewWhenLocked) && item.assetPath) {
      sanitized.imageUrl = item.assetPath;
    }
    return sanitized;
  });

  const owned = items.filter((i) => i.unlocked).length;

  return {
    version: EGG_KEYCHAIN_COLLECTION_VERSION,
    collection: EGG_KEYCHAIN_COLLECTION,
    summary: {
      total: items.length,
      owned,
      locked: items.length - owned,
      mythicEligible,
      nukeEligible,
      quantumUnlocked: Boolean(quantumLegacy.unlocked),
    },
    items,
    lifetimeCollected: { ...progress.lifetimeCollected },
    quantum: buildQuantumPublicState(user, { adminPreview }),
    streamHouseNote:
      'Stream House keychain scanning is not yet live — metadata is prepared for future Savvy Box activation.',
    physicalRedemptionNote:
      'Digital unlock does not automatically create a physical shipment — fulfillment connects through a future verified claim flow.',
  };
}

module.exports = {
  EGG_KEYCHAIN_COLLECTION_VERSION,
  MYTHIC_EGG_KEYCHAIN_ITEM_ID,
  NUKE_EGG_KEYCHAIN_ITEM_ID,
  QUANTUM_EGG_KEYCHAIN_ITEM_ID,
  grantEggKeychainUnlock,
  evaluateMythicEggKeychainGrant,
  evaluateNukeEggKeychainGrant,
  evaluateQuantumEggKeychainGrant,
  getEggKeychainCollectionState,
  isMythicEggKeychainEligible,
  isNukeEggKeychainEligible,
  formatKeychainSerial,
  buildKeychainHistoryRow,
};
