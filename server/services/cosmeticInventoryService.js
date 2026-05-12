const User = require('../models/User');
const { ensureProgressDocuments } = require('./battlePassPersistenceService');
const { EMBLEM_IDS, CALLING_CARD_IDS } = require('../data/cosmeticIds');
const { auditFireAndForget } = require('./securityAuditService');

async function getCosmeticsForUser(userId) {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const { inv } = await ensureProgressDocuments(userId);
  return {
    unlockedItemIds: inv.unlockedItemIds || [],
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
  const unlocked = new Set(inv.unlockedItemIds || []);

  if (!unlocked.has(itemId)) {
    auditFireAndForget('COSMETIC_EQUIP_REJECTED', {
      userId,
      req: auditReq,
      meta: { type, itemId, reason: 'not_unlocked' },
      severity: 'warn',
    });
    const err = new Error('Cosmetic is locked for this account');
    err.status = 403;
    err.code = 'COSMETIC_LOCKED';
    throw err;
  }

  if (type === 'emblem') {
    if (!EMBLEM_IDS.has(itemId)) {
      const err = new Error('Invalid emblem id');
      err.status = 400;
      err.code = 'INVALID_REFERENCE';
      throw err;
    }
    user.equippedCosmetics = user.equippedCosmetics || {};
    if (user.equippedCosmetics.emblemId === itemId) {
      return getCosmeticsForUser(userId);
    }
    user.equippedCosmetics.emblemId = itemId;
  } else if (type === 'calling_card') {
    if (!CALLING_CARD_IDS.has(itemId)) {
      const err = new Error('Invalid calling card id');
      err.status = 400;
      err.code = 'INVALID_REFERENCE';
      throw err;
    }
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

module.exports = {
  getCosmeticsForUser,
  equipCosmetic,
};
