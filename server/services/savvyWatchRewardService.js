/**
 * Savvy Watch — authoritative Savvy grants via existing wallet pipeline.
 */
const crypto = require('crypto');
const SavvyWatchClaim = require('../models/SavvyWatchClaim');
const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const SavvyWatchSession = require('../models/SavvyWatchSession');

function requireGrantSavvyReward() {
  const { grantSavvyReward } = require('./savvyRewardService');
  if (typeof grantSavvyReward !== 'function') {
    throw new TypeError('grantSavvyReward is not a function');
  }
  return grantSavvyReward;
}

class SavvyWatchRewardError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyWatchRewardError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getEventBudgetRemaining(eventId) {
  const event = await SavvyWatchEvent.findOne({ eventId }).lean();
  if (!event) return { remaining: 0, budget: 0, claimed: 0 };
  const budget = Math.round(Number(event.rewardBudget) || 0);
  const claimed = Math.round(Number(event.budgetClaimed) || 0);
  if (budget <= 0) return { remaining: Infinity, budget: 0, claimed };
  return { remaining: Math.max(0, budget - claimed), budget, claimed };
}

async function getViewerSavvyCapRemaining(eventId, userId) {
  const event = await SavvyWatchEvent.findOne({ eventId }).lean();
  const session = await SavvyWatchSession.findOne({ eventId, userId }).lean();
  const maxPerViewer = Math.round(Number(event?.rewardRules?.maxSavvyPerViewer) || 100);
  const earned = Math.round(Number(session?.savvyEarned) || 0);
  return { remaining: Math.max(0, maxPerViewer - earned), maxPerViewer, earned };
}

async function claimSavvyWatchReward(user, {
  eventId,
  sessionId,
  claimType,
  checkpointId = null,
  liveCodeId = null,
  competitionId = null,
  entryId = null,
  amount,
  rewardType,
  note,
  meta = {},
}) {
  const savvyAmount = Math.round(Number(amount) || 0);
  if (savvyAmount <= 0) {
    throw new SavvyWatchRewardError(400, 'INVALID_REWARD', 'Reward amount must be positive.');
  }

  const idempotencyKey = [
    'savvy_watch',
    eventId,
    String(user._id),
    claimType,
    checkpointId || liveCodeId || competitionId || entryId || 'general',
  ].join(':');

  const existing = await SavvyWatchClaim.findOne({ idempotencyKey }).lean();
  if (existing?.status === 'completed') {
    return {
      duplicate: true,
      savvyAmount: 0,
      newBalance: Math.round(Number(user.savvyPoints) || 0),
      claimId: existing.claimId,
    };
  }

  const budget = await getEventBudgetRemaining(eventId);
  if (budget.remaining !== Infinity && savvyAmount > budget.remaining) {
    throw new SavvyWatchRewardError(409, 'EVENT_BUDGET_EXCEEDED', 'Event reward budget would be exceeded.', {
      budget: budget.budget,
      claimed: budget.claimed,
      requested: savvyAmount,
    });
  }

  const viewerCap = await getViewerSavvyCapRemaining(eventId, user._id);
  if (savvyAmount > viewerCap.remaining) {
    throw new SavvyWatchRewardError(409, 'VIEWER_CAP_EXCEEDED', 'Maximum Savvy for this event has been reached.', {
      maxPerViewer: viewerCap.maxPerViewer,
      earned: viewerCap.earned,
      requested: savvyAmount,
    });
  }

  const claimId = `swc_${crypto.randomBytes(8).toString('hex')}`;

  let claimDoc;
  try {
    claimDoc = await SavvyWatchClaim.create({
      claimId,
      eventId,
      userId: user._id,
      sessionId,
      claimType,
      checkpointId,
      liveCodeId,
      competitionId,
      entryId,
      savvyAmount,
      idempotencyKey,
      status: 'pending',
      meta,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const dup = await SavvyWatchClaim.findOne({ idempotencyKey }).lean();
      if (dup) {
        return {
          duplicate: true,
          savvyAmount: 0,
          newBalance: Math.round(Number(user.savvyPoints) || 0),
          claimId: dup.claimId,
        };
      }
    }
    throw err;
  }

  try {
    const grant = await requireGrantSavvyReward()(user, {
      rewardType: rewardType || 'savvy_watch',
      amount: savvyAmount,
      idempotencyKey,
      note: note || `Savvy Watch ${claimType}`,
      meta: { source: 'savvy_watch', eventId, claimType, ...meta },
      applyRewardPolicy: true,
    });

    if (!grant.granted && !grant.duplicate) {
      await SavvyWatchClaim.updateOne({ claimId }, { $set: { status: 'failed', denialReason: 'grant_rejected' } });
      throw new SavvyWatchRewardError(500, 'REWARD_GRANT_FAILED', 'Savvy reward could not be granted.');
    }

    await SavvyWatchClaim.updateOne(
      { claimId },
      {
        $set: {
          status: 'completed',
          transactionId: grant.transactionId || null,
        },
      }
    );

    await SavvyWatchSession.updateOne(
      { eventId, userId: user._id },
      {
        $inc: { savvyEarned: grant.duplicate ? 0 : savvyAmount },
        ...(checkpointId ? { $addToSet: { checkpointClaims: checkpointId } } : {}),
        ...(liveCodeId ? { $addToSet: { liveCodeClaims: liveCodeId } } : {}),
      }
    );

    await SavvyWatchEvent.updateOne({ eventId }, { $inc: { budgetClaimed: grant.duplicate ? 0 : savvyAmount } });

    return {
      duplicate: Boolean(grant.duplicate),
      savvyAmount: grant.duplicate ? 0 : savvyAmount,
      newBalance: grant.newBalance,
      claimId,
      transactionId: grant.transactionId || null,
    };
  } catch (err) {
    await SavvyWatchClaim.updateOne(
      { claimId },
      { $set: { status: 'failed', denialReason: err?.message || 'unknown' } }
    );
    throw err;
  }
}

module.exports = {
  SavvyWatchRewardError,
  requireGrantSavvyReward,
  claimSavvyWatchReward,
  getEventBudgetRemaining,
  getViewerSavvyCapRemaining,
};
