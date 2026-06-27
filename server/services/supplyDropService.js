/**
 * Max Supply Drop — timed claimable reward crates.
 */

const crypto = require('crypto');
const SupplyDrop = require('../models/SupplyDrop');
const User = require('../models/User');
const {
  DEFAULT_CLAIM_WINDOW_MS,
  pickSupplyDropReward,
  rewardToSummary,
} = require('../config/supplyDropRewards');
const { applyEventReward } = require('./eventRewardService');
const { getPerkMachineStatus } = require('./perkMachineService');

class SupplyDropError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function serializeDrop(drop, userId) {
  const uid = String(userId || '');
  const alreadyClaimed = (drop.claims || []).some((c) => String(c.userId) === uid);
  const msLeft = Math.max(0, new Date(drop.expiresAt).getTime() - Date.now());
  return {
    dropId: drop.dropId,
    scope: drop.scope,
    source: drop.source,
    expiresAt: drop.expiresAt,
    msRemaining: msLeft,
    expired: msLeft <= 0 || !drop.active,
    alreadyClaimed,
    rewardPreview: drop.rewardDef ? rewardToSummary(drop.rewardDef) : null,
  };
}

async function expireStaleDrops() {
  await SupplyDrop.updateMany(
    { active: true, expiresAt: { $lte: new Date() } },
    { $set: { active: false } }
  );
}

async function getActiveDropForUser(userId) {
  await expireStaleDrops();
  const now = new Date();
  const uid = userId;

  const userDrop = await SupplyDrop.findOne({
    active: true,
    expiresAt: { $gt: now },
    $or: [
      { scope: 'user', userId: uid },
      { scope: 'global' },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!userDrop) return null;

  if (userDrop.scope === 'global') {
    const claimed = (userDrop.claims || []).some((c) => String(c.userId) === String(uid));
    if (claimed) {
      const other = await SupplyDrop.findOne({
        active: true,
        expiresAt: { $gt: now },
        scope: 'user',
        userId: uid,
      })
        .sort({ createdAt: -1 })
        .lean();
      if (!other) return null;
      return serializeDrop(other, uid);
    }
  }

  return serializeDrop(userDrop, uid);
}

async function createSupplyDrop({
  scope = 'user',
  userId = null,
  createdBy = null,
  source = 'admin',
  durationMs = DEFAULT_CLAIM_WINDOW_MS,
  forceRewardId = null,
}) {
  await expireStaleDrops();

  if (scope === 'user' && !userId) {
    throw new SupplyDropError(400, 'USER_REQUIRED', 'User-scoped drops require userId');
  }

  const rewardDef = pickSupplyDropReward(forceRewardId);
  const dropId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + durationMs);

  if (scope === 'user') {
    await SupplyDrop.updateMany(
      { scope: 'user', userId, active: true },
      { $set: { active: false } }
    );
  }

  const drop = await SupplyDrop.create({
    dropId,
    scope,
    userId: scope === 'user' ? userId : null,
    source,
    createdBy,
    rewardDef,
    expiresAt,
    active: true,
    claims: [],
  });

  return serializeDrop(drop, userId || createdBy);
}

async function claimSupplyDrop(user, dropId) {
  await expireStaleDrops();
  const uid = user._id;

  const drop = await SupplyDrop.findOne({
    dropId,
    active: true,
    expiresAt: { $gt: new Date() },
    claims: { $not: { $elemMatch: { userId: uid } } },
  });

  if (!drop) {
    const existing = await SupplyDrop.findOne({ dropId }).lean();
    if (!existing) {
      throw new SupplyDropError(404, 'DROP_NOT_FOUND', 'Supply drop not found or already expired.');
    }
    if (new Date(existing.expiresAt).getTime() <= Date.now()) {
      throw new SupplyDropError(410, 'DROP_EXPIRED', 'This supply drop has expired.');
    }
    if ((existing.claims || []).some((c) => String(c.userId) === String(uid))) {
      throw new SupplyDropError(409, 'ALREADY_CLAIMED', 'You already claimed this supply drop.');
    }
    throw new SupplyDropError(404, 'DROP_NOT_FOUND', 'Supply drop not found or already expired.');
  }

  if (drop.scope === 'user' && String(drop.userId) !== String(uid)) {
    throw new SupplyDropError(403, 'DROP_FORBIDDEN', 'This supply drop belongs to another operator.');
  }

  const reserved = await SupplyDrop.findOneAndUpdate(
    {
      _id: drop._id,
      active: true,
      expiresAt: { $gt: new Date() },
      claims: { $not: { $elemMatch: { userId: uid } } },
    },
    {
      $push: {
        claims: {
          userId: uid,
          claimedAt: new Date(),
          rewardId: drop.rewardDef?.id,
          rewardLabel: 'Pending',
          rewardPayload: { pending: true },
        },
      },
    },
    { new: true }
  );

  if (!reserved) {
    throw new SupplyDropError(409, 'ALREADY_CLAIMED', 'You already claimed this supply drop.');
  }

  const claimKey = `supply_drop:${dropId}:${uid}`;
  let granted;
  try {
    granted = await applyEventReward(user, drop.rewardDef, claimKey);
  } catch (err) {
    await SupplyDrop.updateOne(
      { _id: drop._id },
      { $pull: { claims: { userId: uid, rewardLabel: 'Pending' } } }
    );
    throw err;
  }

  await SupplyDrop.updateOne(
    { _id: drop._id, 'claims.userId': uid },
    {
      $set: {
        'claims.$.rewardLabel': granted.label,
        'claims.$.rewardPayload': granted,
        ...(drop.scope === 'user' ? { active: false } : {}),
      },
    }
  );

  if (drop.scope === 'user') {
    drop.active = false;
  }

  await user.save();

  if (!Array.isArray(user.supplyDropClaimHistory)) {
    user.supplyDropClaimHistory = [];
  }
  user.supplyDropClaimHistory.unshift({
    dropId: drop.dropId,
    rewardId: granted.id,
    rewardLabel: granted.label,
    claimedAt: new Date(),
  });
  if (user.supplyDropClaimHistory.length > 30) {
    user.supplyDropClaimHistory = user.supplyDropClaimHistory.slice(0, 30);
  }
  user.markModified('supplyDropClaimHistory');
  await user.save();

  return {
    dropId: drop.dropId,
    reward: granted,
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    perkMachine: getPerkMachineStatus(user),
    eventInventory: user.eventInventory || {},
  };
}

async function expireActiveDropsForUser(userId) {
  const result = await SupplyDrop.updateMany(
    {
      active: true,
      $or: [{ scope: 'user', userId }, { scope: 'global' }],
    },
    { $set: { active: false } }
  );
  return { expiredCount: result.modifiedCount || 0 };
}

async function getRecentClaims(limit = 20) {
  const drops = await SupplyDrop.find({ 'claims.0': { $exists: true } })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  const rows = [];
  for (const drop of drops) {
    for (const claim of drop.claims || []) {
      rows.push({
        dropId: drop.dropId,
        scope: drop.scope,
        userId: claim.userId,
        rewardId: claim.rewardId,
        rewardLabel: claim.rewardLabel,
        claimedAt: claim.claimedAt,
        source: drop.source,
      });
    }
  }
  return rows.sort((a, b) => new Date(b.claimedAt) - new Date(a.claimedAt)).slice(0, limit);
}

module.exports = {
  SupplyDropError,
  getActiveDropForUser,
  createSupplyDrop,
  claimSupplyDrop,
  expireActiveDropsForUser,
  getRecentClaims,
  serializeDrop,
};
