/**
 * Single source of truth for all Savvy wallet mutations (credits and debits).
 * Every change writes a SavvyTransaction row with balance before/after.
 */
const crypto = require('crypto');
const User = require('../models/User');
const SavvyTransaction = require('../models/SavvyTransaction');
const { auditRewardGrant } = require('./auditLogger');
const { shouldEmitBattlePassProgress } = require('../config/battlePassTrust');

class InsufficientSavvyError extends Error {
  constructor(balance, required) {
    super(`Insufficient Savvy. Balance=${balance}, required=${required}`);
    this.name = 'InsufficientSavvyError';
    this.code = 'INSUFFICIENT_SAVVY';
    this.balance = balance;
    this.required = required;
  }
}

function resolveUserId(userOrId) {
  if (!userOrId) throw new Error('adjustSavvyBalance requires user or userId');
  return userOrId._id || userOrId;
}

function syncUserDocFromDb(userOrId, dbUser) {
  if (!userOrId || !dbUser || typeof userOrId !== 'object' || !userOrId._id) return;
  userOrId.savvyPoints = Math.round(Number(dbUser.savvyPoints) || 0);
  userOrId.pointsBalance = Math.round(Number(dbUser.pointsBalance) || 0);
  userOrId.lifetimePointsEarned = Math.round(Number(dbUser.lifetimePointsEarned) || 0);
}

function formatDuplicateResult(existing, userOrId) {
  const newBalance =
    existing.balanceAfter != null
      ? existing.balanceAfter
      : Math.round(Number(userOrId?.savvyPoints) || 0);
  return {
    granted: false,
    amount: 0,
    duplicate: true,
    alreadyClaimed: true,
    newBalance,
    balanceBefore: existing.balanceBefore,
    balanceAfter: existing.balanceAfter,
    transactionId: existing.transactionId,
    idempotencyKey: existing.idempotencyKey,
  };
}

/**
 * Atomically adjust Savvy balance. Positive = credit, negative = debit.
 * Idempotent per unique idempotencyKey (SavvyTransaction unique index).
 */
async function adjustSavvyBalance(userOrId, {
  amount,
  source,
  idempotencyKey,
  meta = {},
  rewardType = null,
  note = null,
}) {
  const userId = resolveUserId(userOrId);
  const amt = Math.round(Number(amount) || 0);

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new Error('adjustSavvyBalance requires idempotencyKey');
  }
  if (!source || typeof source !== 'string') {
    throw new Error('adjustSavvyBalance requires source');
  }

  if (amt === 0) {
    const user = await User.findById(userId).lean();
    const bal = Math.round(Number(user?.savvyPoints) || 0);
    return {
      granted: false,
      amount: 0,
      duplicate: false,
      newBalance: bal,
      balanceBefore: bal,
      balanceAfter: bal,
    };
  }

  const existing = await SavvyTransaction.findOne({ idempotencyKey }).lean();
  if (existing?.status === 'completed') {
    return formatDuplicateResult(existing, userOrId);
  }

  const transactionId = crypto.randomUUID();

  try {
    await SavvyTransaction.create({
      transactionId,
      userId,
      source,
      amount: amt,
      idempotencyKey,
      status: 'pending',
      rewardType,
      note,
      meta,
    });
  } catch (e) {
    if (e?.code === 11000) {
      const dup = await SavvyTransaction.findOne({ idempotencyKey }).lean();
      if (dup) return formatDuplicateResult(dup, userOrId);
    }
    throw e;
  }

  let updated;
  if (amt > 0) {
    updated = await User.findOneAndUpdate(
      { _id: userId },
      {
        $inc: {
          savvyPoints: amt,
          pointsBalance: amt,
          lifetimePointsEarned: amt,
        },
      },
      { new: true }
    );
  } else {
    const debit = Math.abs(amt);
    updated = await User.findOneAndUpdate(
      { _id: userId, savvyPoints: { $gte: debit } },
      {
        $inc: {
          savvyPoints: -debit,
          pointsBalance: -debit,
        },
      },
      { new: true }
    );

    if (!updated) {
      await SavvyTransaction.updateOne(
        { idempotencyKey },
        { $set: { status: 'failed', meta: { ...meta, reason: 'insufficient_savvy' } } }
      );
      const user = await User.findById(userId).lean();
      const balance = Math.round(Number(user?.savvyPoints) || 0);
      throw new InsufficientSavvyError(balance, debit);
    }

    // Prevent pointsBalance going negative (legacy sync)
    if (Number(updated.pointsBalance) < 0) {
      await User.updateOne({ _id: userId }, { $set: { pointsBalance: 0 } });
      updated.pointsBalance = 0;
    }
  }

  if (!updated) {
    await SavvyTransaction.updateOne(
      { idempotencyKey },
      { $set: { status: 'failed', meta: { ...meta, reason: 'user_not_found' } } }
    );
    throw new Error(`User not found: ${userId}`);
  }

  const balanceAfter = Math.round(Number(updated.savvyPoints) || 0);
  const balanceBefore = balanceAfter - amt;

  await SavvyTransaction.updateOne(
    { idempotencyKey },
    { $set: { balanceBefore, balanceAfter, status: 'completed' } }
  );

  syncUserDocFromDb(userOrId, updated);

  if (amt > 0) {
    auditRewardGrant({
      userId: String(userId),
      rewardType: rewardType || source,
      granted: true,
      amount: amt,
      idempotencyKey,
      newBalance: balanceAfter,
    });

    setImmediate(() => {
      try {
        if (!shouldEmitBattlePassProgress()) return;
        const { onSavvyCreditedForBattlePass } = require('./progressionServerEventsService');
        void onSavvyCreditedForBattlePass(String(userId), amt, source || rewardType, idempotencyKey);
      } catch (_e) {
        /* non-blocking */
      }
    });
  }

  return {
    granted: true,
    amount: Math.abs(amt),
    signedAmount: amt,
    duplicate: false,
    newBalance: balanceAfter,
    balanceBefore,
    balanceAfter,
    transactionId,
    idempotencyKey,
  };
}

/** Credit wrapper — positive amounts only. */
async function creditSavvy(userOrId, options) {
  const amount = Math.round(Number(options.amount) || 0);
  if (amount <= 0) {
    return adjustSavvyBalance(userOrId, { ...options, amount: 0, source: options.source || 'noop' });
  }
  return adjustSavvyBalance(userOrId, { ...options, amount });
}

/** Debit wrapper — pass positive spend amount. */
async function debitSavvy(userOrId, options) {
  const spend = Math.round(Number(options.amount) || 0);
  if (spend <= 0) {
    return adjustSavvyBalance(userOrId, { ...options, amount: 0, source: options.source || 'noop' });
  }
  return adjustSavvyBalance(userOrId, { ...options, amount: -spend });
}

/**
 * Sum completed SavvyTransaction amounts for a user (audit helper).
 */
async function sumCompletedTransactions(userId) {
  const rows = await SavvyTransaction.aggregate([
    { $match: { userId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return rows[0]?.total || 0;
}

module.exports = {
  adjustSavvyBalance,
  creditSavvy,
  debitSavvy,
  sumCompletedTransactions,
  InsufficientSavvyError,
  syncUserDocFromDb,
};
