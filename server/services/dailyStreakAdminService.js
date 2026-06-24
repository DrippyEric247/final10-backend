const { auditFireAndForget } = require('./securityAuditService');
const {
  ADMIN_MILESTONE_DAYS,
  findMilestoneForDay,
} = require('../config/dailyStreakRewards');
const {
  claimDailyStreak,
  getStreakStatus,
  syncStreakFields,
  clearTodayClaimLock,
  adminGrantMilestoneRewards,
} = require('./dailyStreakService');
const { utcDayKey } = require('../config/savvyRewards');

function adminRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildAdminLogEntry(action, adminUser, targetUser, details = {}) {
  return {
    action,
    timestamp: new Date().toISOString(),
    adminUserId: String(adminUser._id),
    adminUsername: adminUser.username || adminUser.email || 'admin',
    targetUserId: String(targetUser._id),
    targetUsername: targetUser.username || targetUser.email || 'user',
    details,
  };
}

function logAdminStreakAction(action, adminUser, targetUser, details = {}) {
  const entry = buildAdminLogEntry(action, adminUser, targetUser, details);
  auditFireAndForget('STREAK_ADMIN_TEST', {
    userId: adminUser._id,
    meta: entry,
  });
  console.info('[streak/admin/test]', entry);
  return entry;
}

/**
 * Force claim today's streak reward (clears today's claim lock first).
 */
async function adminForceClaimToday(targetUser, adminUser) {
  const before = {
    currentStreak: Number(targetUser.loginStreakDays) || 0,
    lastClaimDate: targetUser.lastDailyClaim || null,
    savvyBalance: Number(targetUser.savvyPoints) || 0,
  };

  clearTodayClaimLock(targetUser);
  const result = await claimDailyStreak(targetUser);

  const log = logAdminStreakAction('force_claim', adminUser, targetUser, {
    before,
    after: {
      currentStreak: result.currentStreak,
      savvyEarned: result.totalSavvy,
      newBalance: result.newBalance,
      alreadyClaimed: result.alreadyClaimed,
    },
  });

  return { ...result, adminLog: log };
}

/**
 * Advance streak by 1 day and reset today's claim lock for re-testing.
 */
async function adminAdvanceStreak(targetUser, adminUser) {
  const today = utcDayKey();
  const prev = Math.max(0, Number(targetUser.loginStreakDays) || 0);
  const next = prev + 1;

  syncStreakFields(targetUser, next);
  targetUser.lastLoginDay = today;
  clearTodayClaimLock(targetUser);
  await targetUser.save();

  const log = logAdminStreakAction('advance_streak', adminUser, targetUser, {
    advancedFrom: prev,
    advancedTo: next,
  });

  return {
    ok: true,
    advancedFrom: prev,
    advancedTo: next,
    status: getStreakStatus(targetUser),
    adminLog: log,
  };
}

/**
 * Set streak to a milestone day and grant that milestone's rewards.
 */
async function adminSetMilestone(targetUser, adminUser, milestoneDay) {
  const day = Math.floor(Number(milestoneDay) || 0);
  if (!ADMIN_MILESTONE_DAYS.includes(day)) {
    const err = new Error(`Milestone must be one of: ${ADMIN_MILESTONE_DAYS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const milestone = findMilestoneForDay(day);
  if (!milestone) {
    const err = new Error('Unknown milestone');
    err.status = 400;
    throw err;
  }

  const before = {
    currentStreak: Number(targetUser.loginStreakDays) || 0,
    savvyBalance: Number(targetUser.savvyPoints) || 0,
  };

  const runId = adminRunId();
  const today = utcDayKey();

  syncStreakFields(targetUser, day);
  targetUser.lastLoginDay = today;
  clearTodayClaimLock(targetUser);

  const grants = await adminGrantMilestoneRewards(targetUser, day, runId);
  await targetUser.save();

  const log = logAdminStreakAction('set_milestone', adminUser, targetUser, {
    before,
    milestoneDay: day,
    milestoneLabel: milestone.label,
    grants,
    adminRunId: runId,
    after: {
      currentStreak: day,
      savvyBalance: Number(targetUser.savvyPoints) || 0,
    },
  });

  return {
    ok: true,
    milestoneDay: day,
    milestoneLabel: milestone.label,
    grants,
    status: getStreakStatus(targetUser),
    adminLog: log,
  };
}

module.exports = {
  adminForceClaimToday,
  adminAdvanceStreak,
  adminSetMilestone,
  ADMIN_MILESTONE_DAYS,
};
