const SavvyPoint = require('../models/SavvyPoint');
const SavvyRewardLog = require('../models/SavvyRewardLog');
const {
  SAVVY_REWARD_TYPES,
  REWARDS,
  utcDayKey,
  yesterdayKey,
  computeDailyLoginSavvy,
} = require('../config/savvyRewards');
const { normalizeTier } = require('../config/subscriptionPlans');

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

  return {
    granted: true,
    amount: savvyAmount,
    duplicate: false,
    newBalance: user.savvyPoints,
  };
}

/**
 * Daily login: task flag + Savvy grant (tier × base + streak milestone).
 */
async function claimDailyLoginReward(user) {
  const today = utcDayKey();
  if (typeof user.resetDailyTasks === 'function') {
    user.resetDailyTasks();
  }

  const idempotencyKey = `daily_login:${user._id}:${today}`;
  const existingLog = await SavvyRewardLog.findOne({ idempotencyKey }).lean();
  const alreadyClaimed =
    Boolean(user.dailyTasks?.completed?.dailyLogin) || Boolean(existingLog);

  if (alreadyClaimed) {
    return {
      granted: false,
      alreadyClaimed: true,
      savvyPointsEarned: 0,
      added: 0,
      newBalance: Number(user.savvyPoints) || 0,
      streakDays: Number(user.loginStreakDays) || 0,
      reward: existingLog
        ? {
            type: existingLog.rewardType,
            amount: existingLog.amount,
            baseAmount: existingLog.baseAmount,
            multiplier: existingLog.multiplier,
            streakBonus: existingLog.streakBonus,
            streakDays: existingLog.streakDays,
            timestamp: existingLog.createdAt,
          }
        : null,
    };
  }

  const streakDays = updateLoginStreak(user, today);
  const tier = readTier(user);
  const breakdown = computeDailyLoginSavvy(tier, streakDays);
  user.dailyTasks.completed.dailyLogin = true;
  user.dailyTasks.pointsEarned += REWARDS.daily_login.legacyPoints;
  user.points += REWARDS.daily_login.legacyPoints;
  user.lastDailyClaim = today;

  const grant = await grantSavvyReward(user, {
    rewardType: SAVVY_REWARD_TYPES.DAILY_LOGIN,
    amount: breakdown.totalSavvy,
    baseAmount: breakdown.baseSavvy,
    multiplier: breakdown.tierMultiplier,
    streakBonus: breakdown.streakBonusSavvy,
    streakDays,
    idempotencyKey,
    note: `Daily login +${breakdown.totalSavvy} (${breakdown.tierMultiplier}x tier)`,
    meta: { scaledBase: breakdown.scaledBase },
  });

  if (typeof user.awardXP === 'function' && grant.granted) {
    await user.awardXP(REWARDS.daily_login.battlePassXp, 'daily_login');
    await user.updateLevelStats('totalDaysActive');
  }

  await user.save();

  const reward = {
    type: SAVVY_REWARD_TYPES.DAILY_LOGIN,
    amount: grant.amount,
    baseAmount: breakdown.baseSavvy,
    multiplier: breakdown.tierMultiplier,
    streakBonus: breakdown.streakBonusSavvy,
    streakDays,
    scaledBase: breakdown.scaledBase,
    timestamp: new Date().toISOString(),
  };

  return {
    granted: grant.granted,
    alreadyClaimed: false,
    savvyPointsEarned: grant.amount,
    added: grant.amount,
    newBalance: grant.newBalance,
    legacyPointsEarned: REWARDS.daily_login.legacyPoints,
    streakDays,
    reward,
    duplicate: grant.duplicate,
  };
}

module.exports = {
  grantSavvyReward,
  claimDailyLoginReward,
  updateLoginStreak,
  readTier,
};
