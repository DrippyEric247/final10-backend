/**
 * Atomic Perk Machine spin lock — one payment / one spin in flight per user.
 */
const User = require('../models/User');
const { utcDayKey } = require('../config/savvyRewards');
const { SPIN_MODES } = require('../config/perkMachineRewards');

/** Max time a spin may hold the lock before stale recovery. */
const SPIN_LOCK_TTL_MS = 30_000;

class SpinLockError extends Error {
  constructor(code, message, status = 429) {
    super(message);
    this.name = 'SpinLockError';
    this.code = code;
    this.status = status;
  }
}

function isLockStale(lockUntil) {
  if (!lockUntil) return true;
  return new Date(lockUntil).getTime() <= Date.now();
}

/**
 * Atomically acquire spin lock. Only one concurrent spin per user.
 * @returns {Promise<import('mongoose').Document>}
 */
async function acquirePerkSpinLock(userId) {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + SPIN_LOCK_TTL_MS);

  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { 'perkMachine.spinLockUntil': { $exists: false } },
        { 'perkMachine.spinLockUntil': null },
        { 'perkMachine.spinLockUntil': { $lte: now } },
      ],
    },
    { $set: { 'perkMachine.spinLockUntil': lockUntil } },
    { new: true }
  );

  if (!user) {
    throw new SpinLockError(
      'SPIN_IN_PROGRESS',
      'Spin already in progress. Please wait.',
      429
    );
  }

  return user;
}

/**
 * Release spin lock after spin completes or fails.
 */
async function releasePerkSpinLock(userId) {
  await User.updateOne(
    { _id: userId },
    { $unset: { 'perkMachine.spinLockUntil': 1 } }
  );
}

/**
 * Atomically claim today's free spin slot (or consume extra free spin).
 * Must be called while holding the spin lock.
 * @returns {{ user: import('mongoose').Document, usedExtraFreeSpin: boolean }}
 */
async function claimFreeSpinSlot(userId) {
  const today = utcDayKey();

  let user = await User.findOneAndUpdate(
    {
      _id: userId,
      'perkMachine.lastFreeSpinDay': { $ne: today },
    },
    { $set: { 'perkMachine.lastFreeSpinDay': today } },
    { new: true }
  );
  if (user) return { user, usedExtraFreeSpin: false };

  user = await User.findOneAndUpdate(
    {
      _id: userId,
      'perkMachine.extraFreeSpins': { $gt: 0 },
    },
    { $inc: { 'perkMachine.extraFreeSpins': -1 } },
    { new: true }
  );
  if (user) return { user, usedExtraFreeSpin: true };

  user = await User.findOneAndUpdate(
    {
      _id: userId,
      'perkMachine.eggInventory.extraFreeSpin': { $gt: 0 },
    },
    { $inc: { 'perkMachine.eggInventory.extraFreeSpin': -1 } },
    { new: true }
  );
  if (user) return { user, usedExtraFreeSpin: true };

  throw new SpinLockError(
    'FREE_SPIN_UNAVAILABLE',
    'Free spin already used today. Come back tomorrow or spend Savvy.',
    400
  );
}

/**
 * Enforce cooldown using persisted lastSpinAt (server clock only).
 */
function assertSpinCooldown(user, adminBypass = false) {
  if (adminBypass) return;
  const pm = user.perkMachine || {};
  const lastSpin = pm.lastSpinAt ? new Date(pm.lastSpinAt).getTime() : 0;
  const { SPIN_COOLDOWN_MS } = require('../config/perkMachineRewards');
  if (lastSpin && Date.now() - lastSpin < SPIN_COOLDOWN_MS) {
    throw new SpinLockError(
      'SPIN_COOLDOWN',
      'Spin already in progress. Please wait.',
      429
    );
  }
}

module.exports = {
  SpinLockError,
  SPIN_LOCK_TTL_MS,
  isLockStale,
  acquirePerkSpinLock,
  releasePerkSpinLock,
  claimFreeSpinSlot,
  assertSpinCooldown,
  SPIN_MODES,
};
