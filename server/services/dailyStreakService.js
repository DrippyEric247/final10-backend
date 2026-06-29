const { utcDayKey, REWARDS } = require('../config/savvyRewards');
const User = require('../models/User');
const {
  STREAK_MILESTONES,
  COMEBACK_REWARDS,
  HIDDEN_ACHIEVEMENTS,
  CALENDAR_DAYS,
  FUTURE_REWARD_SLOTS,
  findMilestoneForDay,
  findNextMilestone,
  findComebackTier,
  daysBetween,
} = require('../config/dailyStreakRewards');
const { grantSavvyReward } = require('./savvyRewardService');
const { ensureProgressDocuments } = require('./battlePassPersistenceService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const { isKnownCosmeticId } = require('../data/cosmeticIds');

const STREAK_REWARD_TYPE = 'daily_streak';

function ensureDailyStreakDoc(user) {
  if (!user.dailyStreak || typeof user.dailyStreak !== 'object') {
    user.dailyStreak = {};
  }
  const ds = user.dailyStreak;
  if (!ds.scoutEggs || typeof ds.scoutEggs !== 'object') {
    ds.scoutEggs = { common: 0, rare: 0, epic: 0, legendary: 0 };
  }
  if (!Array.isArray(ds.claimedMilestoneDays)) ds.claimedMilestoneDays = [];
  if (!Array.isArray(ds.claimedComebackTiers)) ds.claimedComebackTiers = [];
  if (typeof ds.scoutShields !== 'number') ds.scoutShields = 0;
  if (typeof ds.legacyLoyalistUnlocked !== 'boolean') ds.legacyLoyalistUnlocked = false;
  if (typeof ds.shieldsConsumed !== 'number') ds.shieldsConsumed = 0;
  return ds;
}

function syncStreakFields(user, streak) {
  user.loginStreakDays = streak;
  user.currentStreak = streak;
  const longest = Math.max(Number(user.longestStreak) || 0, streak);
  user.longestStreak = longest;
}

function pushUserNotification(user, { kind = 'system', title, body }) {
  if (!Array.isArray(user.notifications)) user.notifications = [];
  user.notifications.unshift({
    kind,
    title: String(title || ''),
    body: String(body || ''),
    createdAt: new Date(),
    readAt: null,
  });
  if (user.notifications.length > 50) {
    user.notifications = user.notifications.slice(0, 50);
  }
}

function grantBadge(user, badgeId) {
  if (!badgeId) return false;
  if (!Array.isArray(user.badges)) user.badges = [];
  if (user.badges.includes(badgeId)) return false;
  user.badges.push(badgeId);
  return true;
}

function addScoutEggs(ds, eggs = {}) {
  for (const [tier, count] of Object.entries(eggs)) {
    const n = Math.max(0, Number(count) || 0);
    if (!n) continue;
    ds.scoutEggs[tier] = Math.max(0, Number(ds.scoutEggs[tier] || 0)) + n;
  }
}

function addScoutShields(ds, count = 0) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return;
  ds.scoutShields = Math.max(0, Number(ds.scoutShields || 0)) + n;
}

/**
 * Update streak with Scout Shield protection when exactly one day was missed.
 */
function updateStreakWithShield(user, today = utcDayKey()) {
  const prevDay = user.lastLoginDay || null;
  let streak = Math.max(0, Number(user.loginStreakDays) || 0);
  const ds = ensureDailyStreakDoc(user);
  let shieldUsed = false;
  let streakReset = false;

  if (prevDay === today) {
    return { streak, changed: false, shieldUsed, streakReset, inactiveDays: 0 };
  }

  const gap = prevDay ? daysBetween(prevDay, today) : Number.POSITIVE_INFINITY;
  const inactiveDays = prevDay && gap > 1 ? gap - 1 : 0;

  if (!prevDay) {
    streak = 1;
  } else if (gap === 1) {
    streak += 1;
  } else if (gap === 2 && ds.scoutShields > 0) {
    ds.scoutShields -= 1;
    ds.shieldsConsumed = (ds.shieldsConsumed || 0) + 1;
    streak += 1;
    shieldUsed = true;
  } else {
    streak = 1;
    streakReset = gap > 2;
  }

  user.lastLoginDay = today;
  syncStreakFields(user, streak);

  return { streak, changed: true, shieldUsed, streakReset, inactiveDays, gap };
}

async function grantMilestoneInventory(user, milestone, grants) {
  const ds = ensureDailyStreakDoc(user);
  if (!milestone) return grants;

  if (ds.claimedMilestoneDays.includes(milestone.day)) {
    return grants;
  }

  if (milestone.scoutEggs) {
    addScoutEggs(ds, milestone.scoutEggs);
    grants.scoutEggs = { ...(grants.scoutEggs || {}), ...milestone.scoutEggs };
  }
  if (milestone.scoutShields) {
    addScoutShields(ds, milestone.scoutShields);
    grants.scoutShields = (grants.scoutShields || 0) + milestone.scoutShields;
  }
  if (milestone.callingCardId && isKnownCosmeticId(milestone.callingCardId)) {
    const unlocked = await grantSystemCosmeticUnlock(user._id, milestone.callingCardId, 'daily_streak');
    if (unlocked) {
      grants.callingCards = [...(grants.callingCards || []), milestone.callingCardId];
    }
  }
  if (milestone.badgeId) {
    if (grantBadge(user, milestone.badgeId)) {
      grants.badges = [...(grants.badges || []), milestone.badgeId];
    }
  }

  if (!ds.claimedMilestoneDays.includes(milestone.day)) {
    ds.claimedMilestoneDays.push(milestone.day);
  }

  return grants;
}

async function applyComebackRewards(user, inactiveDays, grants, today) {
  const ds = ensureDailyStreakDoc(user);
  const tier = findComebackTier(inactiveDays);
  if (!tier) {
    return { grants, comeback: null, savvyGranted: 0 };
  }

  if (ds.claimedComebackTiers.includes(tier.tierKey)) {
    return { grants, comeback: null, savvyGranted: 0 };
  }

  ds.claimedComebackTiers.push(tier.tierKey);
  let savvyGranted = 0;

  if (tier.savvy > 0) {
    const key = `streak_comeback:${user._id}:${tier.tierKey}`;
    const grant = await grantSavvyReward(user, {
      rewardType: 'streak_comeback',
      amount: tier.savvy,
      idempotencyKey: key,
      note: `Comeback reward (${tier.inactiveDays}d inactive) +${tier.savvy} Savvy`,
      meta: { inactiveDays, tierKey: tier.tierKey },
    });
    if (grant.granted) savvyGranted += grant.amount;
  }

  if (tier.scoutEggs) {
    addScoutEggs(ds, tier.scoutEggs);
    grants.scoutEggs = { ...(grants.scoutEggs || {}), ...tier.scoutEggs };
  }
  if (tier.callingCardId && isKnownCosmeticId(tier.callingCardId)) {
    const unlocked = await grantSystemCosmeticUnlock(user._id, tier.callingCardId, 'streak_comeback');
    if (unlocked) {
      grants.callingCards = [...(grants.callingCards || []), tier.callingCardId];
    }
  }

  return {
    grants,
    comeback: {
      tierKey: tier.tierKey,
      inactiveDays: tier.inactiveDays,
      savvy: savvyGranted,
      label: tier.label,
      scoutMessage: "We've been saving something for you, Operator.",
    },
    savvyGranted,
  };
}

async function applyHiddenAchievements(user, streak, grants, today, opts = {}) {
  const ds = ensureDailyStreakDoc(user);
  const adminRunId = opts.adminRunId ? String(opts.adminRunId) : null;
  let totalSavvy = 0;
  const unlocked = [];

  for (const ach of HIDDEN_ACHIEVEMENTS) {
    if (!adminRunId && ds.legacyLoyalistUnlocked && ach.id === 'legacy_loyalist') continue;
    if (streak < ach.requiredStreakDay) continue;

    if (ach.id === 'legacy_loyalist') {
      ds.legacyLoyalistUnlocked = true;
    }

    if (ach.savvy > 0) {
      const key = adminRunId
        ? `streak_admin_hidden:${user._id}:${ach.id}:${adminRunId}`
        : `streak_hidden:${user._id}:${ach.id}:${today}`;
      const grant = await grantSavvyReward(user, {
        rewardType: adminRunId ? 'daily_streak_admin' : 'streak_hidden',
        amount: ach.savvy,
        streakDays: streak,
        idempotencyKey: key,
        note: adminRunId
          ? `[Admin test] Hidden achievement: ${ach.label} +${ach.savvy} Savvy`
          : `Hidden achievement: ${ach.label} +${ach.savvy} Savvy`,
        meta: { achievementId: ach.id, adminTest: Boolean(adminRunId) },
      });
      if (grant.granted) totalSavvy += grant.amount;
    }

    if (ach.badgeId) grantBadge(user, ach.badgeId);
    if (ach.callingCardId && isKnownCosmeticId(ach.callingCardId)) {
      await grantSystemCosmeticUnlock(user._id, ach.callingCardId, adminRunId ? 'streak_admin' : 'streak_hidden');
      grants.callingCards = [...(grants.callingCards || []), ach.callingCardId];
    }

    unlocked.push({
      id: ach.id,
      label: ach.label,
      savvy: ach.savvy,
      hidden: Boolean(ach.hidden),
    });
  }

  if (unlocked.length) {
    grants.hiddenAchievements = unlocked;
  }

  return { grants, savvyGranted: totalSavvy, unlocked };
}

function buildCalendar(currentStreak, claimedMilestoneDays = []) {
  const claimed = new Set(claimedMilestoneDays);
  return CALENDAR_DAYS.map((day) => {
    const milestone = findMilestoneForDay(day);
    return {
      day,
      label: milestone?.label || `Day ${day}`,
      reached: currentStreak >= day,
      claimed: claimed.has(day),
      rewards: milestone
        ? {
            savvy: milestone.savvy || 0,
            scoutEggs: milestone.scoutEggs || null,
            scoutShields: milestone.scoutShields || 0,
            callingCardId: milestone.callingCardId || null,
            badgeId: milestone.badgeId || null,
          }
        : null,
    };
  });
}

function serializeStreakStatus(user) {
  const ds = ensureDailyStreakDoc(user);
  const today = utcDayKey();
  const currentStreak = Math.max(0, Number(user.loginStreakDays) || 0);
  const longestStreak = Math.max(Number(user.longestStreak) || 0, currentStreak);
  const canClaim = user.lastDailyClaim !== today;
  const nextMilestone = findNextMilestone(currentStreak);
  const inactiveDays =
    user.lastLoginDay && user.lastLoginDay !== today
      ? Math.max(0, daysBetween(user.lastLoginDay, today) - 1)
      : 0;

  return {
    currentStreak,
    longestStreak,
    lastLoginDate: user.lastLoginDay || null,
    lastClaimDate: user.lastDailyClaim || null,
    canClaim,
    scoutShields: ds.scoutShields || 0,
    scoutEggs: { ...ds.scoutEggs },
    nextReward: nextMilestone
      ? {
          day: nextMilestone.day,
          daysUntil: Math.max(0, nextMilestone.day - currentStreak),
          label: nextMilestone.label,
          rewards: {
            savvy: nextMilestone.savvy || 0,
            scoutEggs: nextMilestone.scoutEggs || null,
            scoutShields: nextMilestone.scoutShields || 0,
            callingCardId: nextMilestone.callingCardId || null,
            badgeId: nextMilestone.badgeId || null,
          },
        }
      : null,
    calendar: buildCalendar(currentStreak, ds.claimedMilestoneDays),
    milestones: STREAK_MILESTONES,
    comebackTiers: COMEBACK_REWARDS.map((c) => ({
      inactiveDays: c.inactiveDays,
      label: c.label,
      claimed: ds.claimedComebackTiers.includes(c.tierKey),
    })),
    legacyLoyalistUnlocked: Boolean(ds.legacyLoyalistUnlocked),
    inactiveDays,
    futureIntegration: {
      scoutEggsEnabled: true,
      savvyPerkMachine: true,
      battlePassXpPerClaim: FUTURE_REWARD_SLOTS.battlePassXpOnClaim,
      creatorBonuses: true,
    },
  };
}

/**
 * Claim today's daily streak reward (authoritative, atomic daily lock).
 */
async function claimDailyStreak(user) {
  const today = utcDayKey();

  if (typeof user.resetDailyTasks === 'function') {
    user.resetDailyTasks();
  }

  const lockedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      lastDailyClaim: { $ne: today },
    },
    {
      $set: {
        lastDailyClaim: today,
        'dailyTasks.completed.dailyLogin': true,
      },
      $inc: {
        'dailyTasks.pointsEarned': REWARDS.daily_login.legacyPoints,
        points: REWARDS.daily_login.legacyPoints,
      },
    },
    { new: true }
  );

  if (!lockedUser) {
    const fresh = await User.findById(user._id);
    const u = fresh || user;
    return {
      granted: false,
      alreadyClaimed: true,
      totalSavvy: 0,
      added: 0,
      savvyPointsEarned: 0,
      newBalance: Number(u.savvyPoints) || 0,
      currentStreak: Number(u.loginStreakDays) || 0,
      longestStreak: Number(u.longestStreak) || 0,
      streakDays: Number(u.loginStreakDays) || 0,
      status: serializeStreakStatus(u),
      scoutMessage: null,
      shieldUsed: false,
    };
  }

  Object.assign(user, lockedUser.toObject ? lockedUser.toObject() : lockedUser);
  ensureDailyStreakDoc(user);

  const prevDay = user.lastLoginDay;
  const preGap = prevDay ? daysBetween(prevDay, today) : Number.POSITIVE_INFINITY;
  const inactiveDays = prevDay && preGap > 1 ? preGap - 1 : 0;

  let grants = {
    savvy: 0,
    scoutEggs: null,
    scoutShields: 0,
    callingCards: [],
    badges: [],
  };

  let comeback = null;
  if (inactiveDays >= 7) {
    const comebackResult = await applyComebackRewards(user, inactiveDays, grants, today);
    grants = comebackResult.grants;
    comeback = comebackResult.comeback;
    grants.savvy += comebackResult.savvyGranted || 0;
  }

  const streakUpdate = updateStreakWithShield(user, today);
  const streak = streakUpdate.streak;

  if (streakUpdate.shieldUsed) {
    pushUserNotification(user, {
      kind: 'streak_shield',
      title: 'Scout Shield Activated',
      body: 'You missed a day — a Scout Shield kept your streak alive.',
    });
  }

  const milestone = findMilestoneForDay(streak);
  if (milestone?.savvy > 0) {
    const milestoneKey = `streak_milestone:${user._id}:${streak}`;
    const grant = await grantSavvyReward(user, {
      rewardType: STREAK_REWARD_TYPE,
      amount: milestone.savvy,
      streakDays: streak,
      idempotencyKey: milestoneKey,
      note: `Daily streak day ${streak} +${milestone.savvy} Savvy`,
      meta: { milestoneDay: streak },
    });
    if (grant.granted) grants.savvy += grant.amount;
  }

  grants = await grantMilestoneInventory(user, milestone, grants);

  const hiddenResult = await applyHiddenAchievements(user, streak, grants, today);
  grants = hiddenResult.grants;
  grants.savvy += hiddenResult.savvyGranted || 0;

  if (typeof user.awardXP === 'function') {
    await user.awardXP(FUTURE_REWARD_SLOTS.battlePassXpOnClaim, 'daily_login');
    await user.updateLevelStats('totalDaysActive');
  }

  await user.save();

  const scoutMessage = comeback?.scoutMessage
    ? comeback.scoutMessage
    : {
        greeting: 'Welcome back, Operator.',
        streakLine: `Day ${streak} Streak Achieved.`,
      };

  return {
    granted: true,
    alreadyClaimed: false,
    totalSavvy: grants.savvy,
    added: grants.savvy,
    savvyPointsEarned: grants.savvy,
    newBalance: Number(user.savvyPoints) || 0,
    currentStreak: streak,
    longestStreak: Number(user.longestStreak) || streak,
    streakDays: streak,
    shieldUsed: streakUpdate.shieldUsed,
    streakReset: streakUpdate.streakReset,
    comeback,
    milestone: milestone
      ? { day: milestone.day, label: milestone.label, savvy: milestone.savvy || 0 }
      : null,
    grants,
    hiddenAchievements: hiddenResult.unlocked,
    scoutMessage,
    legacyPointsEarned: REWARDS.daily_login.legacyPoints,
    status: serializeStreakStatus(user),
    futureGrants: {
      battlePassXp: FUTURE_REWARD_SLOTS.battlePassXpOnClaim,
      perkMachineTokens: FUTURE_REWARD_SLOTS.perkMachineTokens,
      creatorBonusSavvy: FUTURE_REWARD_SLOTS.creatorBonusSavvy,
    },
    reward: {
      type: STREAK_REWARD_TYPE,
      amount: grants.savvy,
      streakDays: streak,
      timestamp: new Date().toISOString(),
    },
  };
}

function getStreakStatus(user) {
  return serializeStreakStatus(user);
}

function clearTodayClaimLock(user) {
  const today = utcDayKey();
  if (user.lastDailyClaim === today) {
    user.lastDailyClaim = null;
  }
  if (user.dailyTasks?.completed && user.dailyTasks.completed.dailyLogin) {
    user.dailyTasks.completed.dailyLogin = false;
  }
}

/**
 * Admin-only: grant Savvy + inventory for a milestone day (unique idempotency per run).
 */
async function adminGrantMilestoneRewards(user, milestoneDay, adminRunId) {
  const milestone = findMilestoneForDay(milestoneDay);
  if (!milestone) {
    const err = new Error('Invalid milestone day');
    err.status = 400;
    throw err;
  }

  let grants = {
    savvy: 0,
    scoutEggs: null,
    scoutShields: 0,
    callingCards: [],
    badges: [],
  };

  if (milestone.savvy > 0) {
    const grant = await grantSavvyReward(user, {
      rewardType: 'daily_streak_admin',
      amount: milestone.savvy,
      streakDays: milestoneDay,
      idempotencyKey: `streak_admin_milestone:${user._id}:${milestoneDay}:${adminRunId}`,
      note: `[Admin test] Streak day ${milestoneDay} +${milestone.savvy} Savvy`,
      meta: { milestoneDay, adminTest: true, adminRunId },
    });
    if (grant.granted) grants.savvy += grant.amount;
  }

  grants = await grantMilestoneInventory(user, milestone, grants);

  if (milestoneDay >= 100) {
    const hiddenResult = await applyHiddenAchievements(user, milestoneDay, grants, utcDayKey(), {
      adminRunId,
    });
    grants = hiddenResult.grants;
    grants.savvy += hiddenResult.savvyGranted || 0;
  }

  return grants;
}

module.exports = {
  claimDailyStreak,
  getStreakStatus,
  updateStreakWithShield,
  serializeStreakStatus,
  ensureDailyStreakDoc,
  syncStreakFields,
  clearTodayClaimLock,
  adminGrantMilestoneRewards,
};
