/**
 * Savvy Predictions — authoritative fixed Savvy grants via existing wallet pipeline.
 * V1: no stakes, no balance deduction.
 */
const SavvyPredictionPayout = require('../models/SavvyPredictionPayout');
const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const SavvyWatchSession = require('../models/SavvyWatchSession');
const { generatePayoutId } = require('../config/savvyPredictionsConfig');

function requireGrantSavvyReward() {
  const { grantSavvyReward } = require('./savvyRewardService');
  if (typeof grantSavvyReward !== 'function') {
    throw new TypeError('grantSavvyReward is not a function');
  }
  return grantSavvyReward;
}

class SavvyPredictionsRewardError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyPredictionsRewardError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function getPredictionBudgetRemaining(eventId) {
  const event = await SavvyWatchEvent.findOne({ eventId }).lean();
  if (!event) return { remaining: 0, budget: 0, claimed: 0 };
  const budget = Math.round(Number(event.predictionRules?.predictionRewardBudget) || 0);
  const claimed = Math.round(Number(event.predictionRules?.predictionBudgetClaimed) || 0);
  if (budget <= 0) return { remaining: Infinity, budget: 0, claimed };
  return { remaining: Math.max(0, budget - claimed), budget, claimed };
}

async function getPredictionCapRemaining(eventId, userId) {
  const event = await SavvyWatchEvent.findOne({ eventId }).lean();
  const session = await SavvyWatchSession.findOne({ eventId, userId }).lean();
  const maxPerUser = Math.round(Number(event?.predictionRules?.maxPredictionSavvyPerUser) || 100);
  const earned = Math.round(Number(session?.predictionSavvyEarned) || 0);
  return { remaining: Math.max(0, maxPerUser - earned), maxPerUser, earned };
}

async function awardPredictionSavvy(user, {
  eventId,
  predictionId,
  entryId,
  amount,
  payoutType = 'correct',
  rewardType = 'savvy_prediction_correct',
  note,
  meta = {},
}) {
  const savvyAmount = Math.round(Number(amount) || 0);
  if (savvyAmount <= 0) {
    throw new SavvyPredictionsRewardError(400, 'INVALID_REWARD', 'Reward amount must be positive.');
  }

  const idempotencyKey = [
    'savvy_prediction',
    eventId,
    String(user._id),
    predictionId,
    payoutType,
    entryId,
  ].join(':');

  const existing = await SavvyPredictionPayout.findOne({ idempotencyKey }).lean();
  if (existing?.status === 'completed') {
    return {
      duplicate: true,
      savvyAmount: 0,
      newBalance: Math.round(Number(user.savvyPoints) || 0),
      payoutId: existing.payoutId,
    };
  }

  const budget = await getPredictionBudgetRemaining(eventId);
  if (budget.remaining !== Infinity && savvyAmount > budget.remaining) {
    throw new SavvyPredictionsRewardError(409, 'PREDICTION_BUDGET_EXCEEDED', 'Event prediction reward budget would be exceeded.', {
      budget: budget.budget,
      claimed: budget.claimed,
      requested: savvyAmount,
    });
  }

  const cap = await getPredictionCapRemaining(eventId, user._id);
  if (savvyAmount > cap.remaining) {
    throw new SavvyPredictionsRewardError(409, 'PREDICTION_CAP_EXCEEDED', 'Maximum prediction Savvy for this event has been reached.', {
      maxPerUser: cap.maxPerUser,
      earned: cap.earned,
      requested: savvyAmount,
    });
  }

  const payoutId = generatePayoutId();

  let payoutDoc;
  try {
    payoutDoc = await SavvyPredictionPayout.create({
      payoutId,
      predictionId,
      eventId,
      userId: user._id,
      entryId,
      payoutType,
      savvyAmount,
      idempotencyKey,
      status: 'pending',
      meta,
    });
  } catch (err) {
    if (err?.code === 11000) {
      const dup = await SavvyPredictionPayout.findOne({ idempotencyKey }).lean();
      if (dup) {
        return {
          duplicate: true,
          savvyAmount: 0,
          newBalance: Math.round(Number(user.savvyPoints) || 0),
          payoutId: dup.payoutId,
        };
      }
    }
    throw err;
  }

  try {
    const grant = await requireGrantSavvyReward()(user, {
      rewardType,
      amount: savvyAmount,
      idempotencyKey,
      note: note || `Savvy Prediction ${payoutType}`,
      meta: { source: rewardType, eventId, predictionId, payoutType, ...meta },
      applyRewardPolicy: true,
    });

    if (!grant.granted && !grant.duplicate) {
      await SavvyPredictionPayout.updateOne({ payoutId }, { $set: { status: 'failed', denialReason: 'grant_rejected' } });
      throw new SavvyPredictionsRewardError(500, 'REWARD_GRANT_FAILED', 'Savvy prediction reward could not be granted.');
    }

    await SavvyPredictionPayout.updateOne(
      { payoutId },
      { $set: { status: 'completed', transactionId: grant.transactionId || null } }
    );

    await SavvyWatchSession.updateOne(
      { eventId, userId: user._id },
      {
        $inc: {
          predictionSavvyEarned: grant.duplicate ? 0 : savvyAmount,
          savvyEarned: grant.duplicate ? 0 : savvyAmount,
        },
      }
    );

    await SavvyWatchEvent.updateOne(
      { eventId },
      { $inc: { 'predictionRules.predictionBudgetClaimed': grant.duplicate ? 0 : savvyAmount } }
    );

    return {
      duplicate: Boolean(grant.duplicate),
      savvyAmount: grant.duplicate ? 0 : savvyAmount,
      newBalance: grant.newBalance,
      payoutId,
      transactionId: grant.transactionId || null,
    };
  } catch (err) {
    await SavvyPredictionPayout.updateOne(
      { payoutId },
      { $set: { status: 'failed', denialReason: err?.message || 'unknown' } }
    );
    throw err;
  }
}

module.exports = {
  SavvyPredictionsRewardError,
  requireGrantSavvyReward,
  awardPredictionSavvy,
  getPredictionBudgetRemaining,
  getPredictionCapRemaining,
};
