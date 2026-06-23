const mongoose = require('mongoose');
const User = require('../models/User');
const { ensureProgressDocuments } = require('./battlePassPersistenceService');
const {
  EMBLEM_IDS,
  CALLING_CARD_IDS,
  isKnownCosmeticId,
  roleAutoUnlockIds,
} = require('../data/cosmeticIds');
const { auditFireAndForget } = require('./securityAuditService');

function addUnlocks(inventory, ids) {
  const set = new Set(inventory.unlockedItemIds || []);
  for (const id of ids) {
    if (id) set.add(id);
  }
  inventory.unlockedItemIds = [...set];
}

function removeUnlock(inventory, itemId) {
  inventory.unlockedItemIds = (inventory.unlockedItemIds || []).filter((id) => id !== itemId);
  inventory.newItemIds = (inventory.newItemIds || []).filter((id) => id !== itemId);
}

function effectiveUnlockedSet(inv, user) {
  const set = new Set(inv.unlockedItemIds || []);
  for (const id of roleAutoUnlockIds(user?.role)) set.add(id);
  return set;
}

async function resolveUserByKey(userKey) {
  const key = String(userKey || '').trim();
  if (!key) {
    const err = new Error('userKey is required');
    err.status = 400;
    err.code = 'MISSING_USER';
    throw err;
  }

  if (mongoose.Types.ObjectId.isValid(key)) {
    const byId = await User.findById(key);
    if (byId) return byId;
  }

  const normalizedEmail = key.includes('@') ? key.toLowerCase() : key;
  const user = await User.findOne({
    $or: [{ username: key }, { email: normalizedEmail }],
  });
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  return user;
}

function logEquipRejection(context) {
  console.warn('[cosmetics/equip] 403 rejection', context);
}

async function getCosmeticsForUser(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const { inv } = await ensureProgressDocuments(userId);
  const unlocked = [...effectiveUnlockedSet(inv, user)];
  return {
    unlockedItemIds: unlocked,
    newItemIds: inv.newItemIds || [],
    equipped: {
      emblemId: user.equippedCosmetics?.emblemId || 'sigil_starter',
      callingCardId: user.equippedCosmetics?.callingCardId || 'card_default',
      titleId: user.equippedCosmetics?.titleId || null,
    },
  };
}

/**
 * @param {'emblem'|'calling_card'|'title'} type
 * @param {string} itemId
 */
async function equipCosmetic(userId, type, itemId, options = {}) {
  const { req: auditReq } = options;
  const userIdStr = String(userId);

  if (!itemId || typeof itemId !== 'string') {
    const err = new Error('itemId is required');
    err.status = 400;
    err.code = 'INVALID_ITEM';
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const { inv } = await ensureProgressDocuments(userId);
  const inventoryContents = [...(inv.unlockedItemIds || [])];
  const roleAuto = roleAutoUnlockIds(user.role);
  const unlocked = effectiveUnlockedSet(inv, user);

  const rejectContext = {
    userId: userIdStr,
    jwtUserId: userIdStr,
    cosmeticId: itemId,
    cosmeticType: type,
    inventoryUnlockedItemIds: inventoryContents,
    roleAutoUnlockIds: roleAuto,
    effectiveUnlockedItemIds: [...unlocked],
  };

  if (type === 'emblem' && !EMBLEM_IDS.has(itemId)) {
    logEquipRejection({
      ...rejectContext,
      reason: 'INVALID_REFERENCE:emblem_id_not_in_catalog',
      rejectLine: 'cosmeticInventoryService.js:equipCosmetic EMBLEM_IDS.has(itemId)',
    });
    const err = new Error('Invalid emblem id');
    err.status = 400;
    err.code = 'INVALID_REFERENCE';
    throw err;
  }

  if (type === 'calling_card' && !CALLING_CARD_IDS.has(itemId)) {
    logEquipRejection({
      ...rejectContext,
      reason: 'INVALID_REFERENCE:calling_card_id_not_in_catalog',
      rejectLine: 'cosmeticInventoryService.js:equipCosmetic CALLING_CARD_IDS.has(itemId)',
    });
    const err = new Error('Invalid calling card id');
    err.status = 400;
    err.code = 'INVALID_REFERENCE';
    throw err;
  }

  if (!unlocked.has(itemId)) {
    logEquipRejection({
      ...rejectContext,
      reason: 'COSMETIC_LOCKED:itemId_not_in_unlockedItemIds_or_role_auto_grants',
      rejectLine: 'cosmeticInventoryService.js:equipCosmetic unlocked.has(itemId) — line ~148',
      hint:
        'Admin grants must be persisted via POST /api/cosmetics/admin/grant; client-only localStorage grants are not visible to the server.',
    });
    auditFireAndForget('COSMETIC_EQUIP_REJECTED', {
      userId,
      req: auditReq,
      meta: { type, itemId, reason: 'not_unlocked', inventoryContents, roleAuto },
      severity: 'warn',
    });
    const err = new Error('Cosmetic is locked for this account');
    err.status = 403;
    err.code = 'COSMETIC_LOCKED';
    throw err;
  }

  if (type === 'emblem') {
    user.equippedCosmetics = user.equippedCosmetics || {};
    if (user.equippedCosmetics.emblemId === itemId) {
      return getCosmeticsForUser(userId);
    }
    user.equippedCosmetics.emblemId = itemId;
  } else if (type === 'calling_card') {
    user.equippedCosmetics = user.equippedCosmetics || {};
    if (user.equippedCosmetics.callingCardId === itemId) {
      return getCosmeticsForUser(userId);
    }
    user.equippedCosmetics.callingCardId = itemId;
  } else if (type === 'title') {
    user.equippedCosmetics = user.equippedCosmetics || {};
    if (user.equippedCosmetics.titleId === itemId) {
      return getCosmeticsForUser(userId);
    }
    user.equippedCosmetics.titleId = itemId;
  } else {
    const err = new Error('type must be emblem, calling_card, or title');
    err.status = 400;
    err.code = 'INVALID_TYPE';
    throw err;
  }

  await user.save();

  auditFireAndForget('COSMETIC_EQUIP', {
    userId,
    req: auditReq,
    meta: { type, itemId },
  });

  return getCosmeticsForUser(userId);
}

/** System reward unlock (daily streak, battle pass, etc.) — no admin required. */
async function grantSystemCosmeticUnlock(userId, itemId, source = 'system') {
  const id = String(itemId || '').trim();
  if (!id || !isKnownCosmeticId(id)) return false;

  const { inv } = await ensureProgressDocuments(userId);
  const had = (inv.unlockedItemIds || []).includes(id);
  addUnlocks(inv, [id]);
  await inv.save();

  if (!had) {
    auditFireAndForget('COSMETIC_SYSTEM_GRANT', {
      userId,
      meta: { itemId: id, source: String(source || 'system').slice(0, 64) },
    });
  }

  return !had;
}

async function grantCosmeticUnlock(adminUserId, userKey, itemId, note = '') {
  const id = String(itemId || '').trim();
  if (!id) {
    const err = new Error('itemId is required');
    err.status = 400;
    err.code = 'MISSING_ITEM';
    throw err;
  }
  if (!isKnownCosmeticId(id)) {
    const err = new Error('Unknown cosmetic id');
    err.status = 400;
    err.code = 'INVALID_REFERENCE';
    throw err;
  }

  const targetUser = await resolveUserByKey(userKey);
  const { inv } = await ensureProgressDocuments(targetUser._id);
  addUnlocks(inv, [id]);
  await inv.save();

  auditFireAndForget('COSMETIC_ADMIN_GRANT', {
    userId: adminUserId,
    meta: {
      targetUserId: String(targetUser._id),
      targetUsername: targetUser.username,
      itemId: id,
      note: String(note || '').slice(0, 240),
    },
  });

  console.info('[cosmetics/admin/grant] unlocked', {
    adminUserId: String(adminUserId),
    targetUserId: String(targetUser._id),
    targetUsername: targetUser.username,
    itemId: id,
    inventoryUnlockedItemIds: inv.unlockedItemIds,
  });

  return getCosmeticsForUser(targetUser._id);
}

async function revokeCosmeticUnlock(adminUserId, userKey, itemId) {
  const id = String(itemId || '').trim();
  if (!id) {
    const err = new Error('itemId is required');
    err.status = 400;
    err.code = 'MISSING_ITEM';
    throw err;
  }

  const targetUser = await resolveUserByKey(userKey);
  const { inv } = await ensureProgressDocuments(targetUser._id);
  const had = (inv.unlockedItemIds || []).includes(id);
  if (!had) {
    const err = new Error('That user does not have this cosmetic unlocked');
    err.status = 404;
    err.code = 'NOT_GRANTED';
    throw err;
  }

  removeUnlock(inv, id);
  await inv.save();

  if (
    targetUser.equippedCosmetics?.emblemId === id ||
    targetUser.equippedCosmetics?.callingCardId === id ||
    targetUser.equippedCosmetics?.titleId === id
  ) {
    if (targetUser.equippedCosmetics.emblemId === id) {
      targetUser.equippedCosmetics.emblemId = 'sigil_starter';
    }
    if (targetUser.equippedCosmetics.callingCardId === id) {
      targetUser.equippedCosmetics.callingCardId = 'card_default';
    }
    if (targetUser.equippedCosmetics.titleId === id) {
      targetUser.equippedCosmetics.titleId = null;
    }
    await targetUser.save();
  }

  auditFireAndForget('COSMETIC_ADMIN_REVOKE', {
    userId: adminUserId,
    meta: {
      targetUserId: String(targetUser._id),
      targetUsername: targetUser.username,
      itemId: id,
    },
  });

  return getCosmeticsForUser(targetUser._id);
}

async function inspectCosmeticUnlockState(userKey) {
  const user = await resolveUserByKey(userKey);
  const { inv } = await ensureProgressDocuments(user._id);
  const inventoryUnlockedItemIds = [...(inv.unlockedItemIds || [])];
  const roleAutoUnlockIdsList = roleAutoUnlockIds(user.role);
  const effectiveUnlockedItemIds = [...effectiveUnlockedSet(inv, user)];

  return {
    userId: String(user._id),
    email: user.email,
    username: user.username,
    role: user.role,
    equippedCosmetics: user.equippedCosmetics || null,
    inventoryUnlockedItemIds,
    roleAutoUnlockIds: roleAutoUnlockIdsList,
    effectiveUnlockedItemIds,
  };
}

module.exports = {
  getCosmeticsForUser,
  equipCosmetic,
  grantCosmeticUnlock,
  grantSystemCosmeticUnlock,
  revokeCosmeticUnlock,
  resolveUserByKey,
  inspectCosmeticUnlockState,
};
