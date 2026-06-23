const SavvyPoint = require('../models/SavvyPoint');
const SavvyRewardLog = require('../models/SavvyRewardLog');
const {
  SAVVY_REWARD_TYPES,
  utcDayKey,
  yesterdayKey,
} = require('../config/savvyRewards');
const { normalizeTier } = require('../config/subscriptionPlans');
const { auditRewardGrant } = require('./auditLogger');

function readTier(user) {
  return normalizeTier(user.subscription?.tier || user.membershipTier || 'free');
}

function updateLoginStreak(user, today = utcDayKey()) {
  const prevDay = user.lastLoginDay || null;
  let streak = Math.max(0, Number(user.loginStreakDays) || 0);

  if (prevDay === today) {
    return streak;
  }
  if (prevDay === yesterdayKey(today)) {
    streak += 1;
  } else {
    streak = 1;
  }
  user.lastLoginDay = today;
  user.loginStreakDays = streak;
  return streak;
}

/**
 * Grant Savvy to wallet with ledger + audit log. Idempotent per `idempotencyKey`.
 */
async function grantSavvyReward(user, {
  rewardType,
  amount,
  baseAmount = 0,
  multiplier = 1,
  streakBonus = 0,
  streakDays = 0,
  idempotencyKey,
  note,
  meta = {},
}) {
  const savvyAmount = Math.round(Number(amount) || 0);
  if (!savvyAmount || savvyAmount <= 0) {
    return { granted: false, amount: 0, duplicate: false, newBalance: Number(user.savvyPoints) || 0 };
  }
  if (!idempotencyKey) {
    throw new Error('grantSavvyReward requires idempotencyKey');
  }

  try {
    await SavvyRewardLog.create({
      userId: user._id,
      rewardType,
      amount: savvyAmount,
      baseAmount,
      multiplier,
      streakBonus,
      streakDays,
      tier: readTier(user),
      idempotencyKey,
      meta,
    });
  } catch (e) {
    if (e?.code === 11000) {
      auditRewardGrant({
        userId: String(user._id),
        rewardType,
        granted: false,
        duplicate: true,
        idempotencyKey,
      });
      return {
        granted: false,
        amount: 0,
        duplicate: true,
        newBalance: Number(user.savvyPoints) || 0,
      };
    }
    throw e;
  }

  user.savvyPoints = Number(user.savvyPoints || 0) + savvyAmount;
  user.pointsBalance = Number(user.pointsBalance || 0) + savvyAmount;
  user.lifetimePointsEarned = Number(user.lifetimePointsEarned || 0) + savvyAmount;

  try {
    const pointType =
      rewardType === SAVVY_REWARD_TYPES.STREAK_BONUS || rewardType === 'beta_feedback'
        ? 'bonus'
        : rewardType === SAVVY_REWARD_TYPES.DAILY_LOGIN
          ? 'daily_login'
          : 'bonus';
    await SavvyPoint.create({
      user_id: user._id,
      type: pointType,
      amount: savvyAmount,
      note: note || `${rewardType} +${savvyAmount}`,
    });
  } catch (err) {
    console.warn('[savvyReward] SavvyPoint ledger write failed:', err?.message);
  }

  auditRewardGrant({
    userId: String(user._id),
    rewardType,
    granted: true,
    amount: savvyAmount,
    idempotencyKey,
    newBalance: user.savvyPoints,
  });

  return {
    granted: true,
    amount: savvyAmount,
    duplicate: false,
    newBalance: user.savvyPoints,
  };
}

/**
 * Daily login — delegates to daily streak system (milestones, shields, comeback).
 */
async function claimDailyLoginReward(user) {
  const { claimDailyStreak } = require('./dailyStreakService');
  const result = await claimDailyStreak(user);

  return {
    granted: result.granted,
    alreadyClaimed: result.alreadyClaimed,
    savvyPointsEarned: result.savvyPointsEarned ?? result.totalSavvy ?? 0,
    added: result.added ?? result.totalSavvy ?? 0,
    newBalance: result.newBalance,
    legacyPointsEarned: result.legacyPointsEarned || 0,
    streakDays: result.streakDays ?? result.currentStreak ?? 0,
    currentStreak: result.currentStreak,
    longestStreak: result.longestStreak,
    reward: result.reward,
    duplicate: false,
    streakClaim: result,
    scoutMessage: result.scoutMessage,
    shieldUsed: result.shieldUsed,
    grants: result.grants,
    comeback: result.comeback,
    milestone: result.milestone,
    hiddenAchievements: result.hiddenAchievements,
    status: result.status,
  };
}

module.exports = {
  grantSavvyReward,
  claimDailyLoginReward,
  updateLoginStreak,
  readTier,
};
