const { normalizeTier } = require('../config/subscriptionPlans');
const {
  MONTHLY_GOALS_COMPLETION_BONUS,
  DEFAULT_GOAL_REWARD_SAVVY,
} = require('../config/monthlyScoutGoals');

function getMonthKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFromKey(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) return 'This Month';
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function resolveSubscriptionTier(user = {}, activity = {}) {
  const raw =
    activity.subscriptionTier ||
    user?.subscription?.tier ||
    user?.membershipTier ||
    user?.subscriptionTier ||
    'free';
  return normalizeTier(raw);
}

function tierBonusKey(tier) {
  const t = normalizeTier(tier);
  if (t === 'pro' || t === 'elite') return 'pro';
  if (t === 'core') return 'premium';
  return 'free';
}

function num(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

function makeGoal({
  id,
  title,
  current,
  target,
  rewardSavvy = DEFAULT_GOAL_REWARD_SAVVY,
  completed: completedOverride,
  progressLabel: progressLabelOverride,
  secondaryProgress,
}) {
  const t = Math.max(1, Math.round(Number(target) || 1));
  const c = Math.min(t, Math.max(0, Math.round(Number(current) || 0)));
  let completed = completedOverride != null ? Boolean(completedOverride) : c >= t;
  let progressLabel = progressLabelOverride || `${c} / ${t}`;

  if (secondaryProgress) {
    const sc = Math.max(0, Math.round(Number(secondaryProgress.current) || 0));
    const st = Math.max(1, Math.round(Number(secondaryProgress.target) || 1));
    progressLabel = progressLabelOverride || `${c} / ${t} · ${Math.min(sc, st)} / ${st} days`;
    if (completedOverride == null) {
      completed = c >= t && sc >= st;
    }
  }

  const progressPercent = completed
    ? 100
    : Math.max(0, Math.min(100, Math.round((c / t) * 100)));

  return {
    id: String(id),
    title: String(title),
    current: c,
    target: t,
    rewardSavvy: Math.max(0, Math.round(Number(rewardSavvy) || DEFAULT_GOAL_REWARD_SAVVY)),
    completed,
    progressPercent,
    progressLabel,
  };
}

/**
 * Classify user segment for goal templates.
 * Priority: inactive → new → tier-based.
 */
function classifyUserSegment(user = {}, activity = {}) {
  const loginDays = num(activity.loginDaysThisMonth, activity.daysActiveThisMonth);
  const daysSinceActive = num(
    activity.daysSinceLastActive,
    user?.daysSinceLastActive
  );
  const accountAgeDays = num(
    activity.accountAgeDays,
    user?.accountAgeDays
  );
  const isNewUser =
    activity.isNewUser === true ||
    accountAgeDays > 0 && accountAgeDays < 14 ||
    (num(activity.alertsCreated) === 0 && num(activity.bestMovesUsed) < 3 && loginDays < 5);

  const isInactive =
    activity.isInactive === true ||
    daysSinceActive > 7 ||
    loginDays < 3;

  if (isInactive) return 'inactive';
  if (isNewUser) return 'new';
  const tier = resolveSubscriptionTier(user, activity);
  if (tier === 'pro' || tier === 'elite') return 'pro';
  if (tier === 'core') return 'premium';
  return 'free';
}

function goalTemplatesForSegment(segment, activity = {}) {
  const alerts = num(activity.alertsCreated);
  const bestMoves = num(activity.bestMovesUsed);
  const bestMoveDays = num(activity.bestMoveActiveDays, activity.bestMoveDaysUsed);
  const savvy = num(activity.savvyEarned);
  const bpTier = num(activity.battlePassTier);
  const streakClaims = num(activity.streakDaysClaimedThisMonth, activity.currentStreak);
  const eggsActivated = num(activity.eggsActivated, activity.eggsCollected);
  const reportOpened = Boolean(activity.monthlyReportOpened);
  const loginDays = num(activity.loginDaysThisMonth, activity.daysActiveThisMonth);

  if (segment === 'inactive') {
    return [
      makeGoal({ id: 'return_days', title: 'Return 5 days this month', current: loginDays, target: 5, rewardSavvy: 120 }),
      makeGoal({ id: 'best_moves', title: 'Use 3 Best Moves', current: bestMoves, target: 3, rewardSavvy: 80 }),
      makeGoal({ id: 'open_report', title: 'Open Monthly Report', current: reportOpened ? 1 : 0, target: 1, rewardSavvy: 50 }),
    ];
  }

  if (segment === 'new') {
    return [
      makeGoal({ id: 'alerts', title: 'Create 3 Alerts', current: alerts, target: 3, rewardSavvy: 100 }),
      makeGoal({ id: 'best_moves', title: 'Use 5 Best Moves', current: bestMoves, target: 5, rewardSavvy: 100 }),
      makeGoal({ id: 'streak', title: 'Claim Daily Streak 7 Days', current: streakClaims, target: 7, rewardSavvy: 150 }),
    ];
  }

  if (segment === 'premium') {
    return [
      makeGoal({
        id: 'best_move_days',
        title: 'Use 10 Best Moves on 5 different days',
        current: bestMoves,
        target: 10,
        secondaryProgress: { current: bestMoveDays, target: 5 },
        rewardSavvy: 150,
      }),
      makeGoal({ id: 'savvy_earn', title: 'Earn 1,000 Savvy', current: savvy, target: 1000, rewardSavvy: 200 }),
      makeGoal({ id: 'bp_tier', title: 'Reach Battle Pass Tier 15', current: bpTier, target: 15, rewardSavvy: 175 }),
      makeGoal({ id: 'alerts', title: 'Create 5 Alerts', current: alerts, target: 5, rewardSavvy: 100 }),
    ];
  }

  if (segment === 'pro') {
    return [
      makeGoal({ id: 'best_moves', title: 'Use 25 Best Moves', current: bestMoves, target: 25, rewardSavvy: 200 }),
      makeGoal({ id: 'savvy_earn', title: 'Earn 2,500 Savvy', current: savvy, target: 2500, rewardSavvy: 300 }),
      makeGoal({ id: 'eggs', title: 'Activate 3 Eggs', current: eggsActivated, target: 3, rewardSavvy: 250 }),
      makeGoal({ id: 'bp_tier', title: 'Reach Battle Pass Tier 25', current: bpTier, target: 25, rewardSavvy: 275 }),
    ];
  }

  // free
  return [
    makeGoal({
      id: 'best_move_days',
      title: 'Use 5 Best Moves on 5 different days',
      current: bestMoves,
      target: 5,
      secondaryProgress: { current: bestMoveDays, target: 5 },
      rewardSavvy: 100,
    }),
    makeGoal({ id: 'alerts', title: 'Create 5 Alerts', current: alerts, target: 5, rewardSavvy: 100 }),
    makeGoal({ id: 'bp_tier', title: 'Reach Battle Pass Tier 5', current: bpTier, target: 5, rewardSavvy: 125 }),
    makeGoal({ id: 'streak', title: 'Maintain a 7-Day Streak', current: streakClaims, target: 7, rewardSavvy: 100 }),
  ];
}

/**
 * Generate 3–5 personalized monthly goals from user + activity snapshot.
 */
function generateMonthlyScoutGoals(user = {}, activity = {}) {
  const segment = classifyUserSegment(user, activity);
  const tier = resolveSubscriptionTier(user, activity);
  const templates = goalTemplatesForSegment(segment, activity);
  const goals = templates.slice(0, 5);
  while (goals.length < 3 && templates.length > goals.length) {
    goals.push(templates[goals.length]);
  }

  const completedCount = goals.filter((g) => g.completed).length;
  const allComplete = goals.length > 0 && completedCount === goals.length;
  const bonusKey = tierBonusKey(tier);
  const completionBonusSavvy = MONTHLY_GOALS_COMPLETION_BONUS[bonusKey] || MONTHLY_GOALS_COMPLETION_BONUS.free;
  const monthKey = getMonthKey(activity.reportDate || new Date());
  const alreadyClaimed = hasClaimedMonthlyGoalsBonus(user, monthKey);

  return {
    monthKey,
    segment,
    tier,
    tierLabel: bonusKey === 'pro' ? 'Pro' : bonusKey === 'premium' ? 'Premium' : 'Free',
    goals,
    completedCount,
    totalGoals: goals.length,
    allComplete,
    completionBonusSavvy,
    completionBonusClaimed: alreadyClaimed,
    completionBonusAvailable: allComplete && !alreadyClaimed,
    scoutGoalsMessage:
      'Operator, I found a few goals that can level up your account this month. Complete them all and claim your bonus.',
    completionBonusPanelTitle:
      '🏆 Complete all Scout Goals this month to earn your Monthly Completion Bonus.',
  };
}

function hasClaimedMonthlyGoalsBonus(user = {}, monthKey = getMonthKey()) {
  const claimed = user?.scoutMonthlyGoals?.completionBonusClaimedMonths;
  if (!Array.isArray(claimed)) return false;
  return claimed.includes(monthKey);
}

/**
 * Grant monthly completion bonus once per month (idempotent).
 * @returns {{ granted: boolean, reason?: string, amount?: number, monthKey: string }}
 */
async function claimMonthlyGoalsCompletionBonus(user, { monthKey = getMonthKey(), goals = null } = {}) {
  if (!user || typeof user.save !== 'function') {
    return { granted: false, reason: 'invalid_user', monthKey };
  }

  if (!user.scoutMonthlyGoals) user.scoutMonthlyGoals = {};
  if (!Array.isArray(user.scoutMonthlyGoals.completionBonusClaimedMonths)) {
    user.scoutMonthlyGoals.completionBonusClaimedMonths = [];
  }

  if (user.scoutMonthlyGoals.completionBonusClaimedMonths.includes(monthKey)) {
    return { granted: false, reason: 'already_claimed', monthKey };
  }

  const goalSet =
    goals ||
    generateMonthlyScoutGoals(user, {
      ...user.scoutMonthlyGoals?.lastActivitySnapshot,
      reportDate: `${monthKey}-01`,
    }).goals;

  const allComplete = goalSet.length > 0 && goalSet.every((g) => g.completed);
  if (!allComplete) {
    return { granted: false, reason: 'goals_incomplete', monthKey };
  }

  const tier = resolveSubscriptionTier(user);
  const amount = MONTHLY_GOALS_COMPLETION_BONUS[tierBonusKey(tier)] || MONTHLY_GOALS_COMPLETION_BONUS.free;

  user.scoutMonthlyGoals.completionBonusClaimedMonths.push(monthKey);
  user.scoutMonthlyGoals.lastCompletionBonusMonthKey = monthKey;
  user.scoutMonthlyGoals.lastCompletionBonusAt = new Date();
  user.scoutMonthlyGoals.lastCompletionBonusAmount = amount;
  user.savvyPoints = num(user.savvyPoints) + amount;

  await user.save();

  return { granted: true, amount, monthKey };
}

/** Build activity snapshot from user doc + optional overrides for email/report. */
function activitySnapshotFromUser(user = {}, overrides = {}) {
  const createdAt = user?.createdAt ? new Date(user.createdAt) : null;
  const accountAgeDays = createdAt
    ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86400000))
    : num(overrides.accountAgeDays);

  const lastActive = user?.lastActive ? new Date(user.lastActive) : null;
  const daysSinceLastActive = lastActive
    ? Math.max(0, Math.floor((Date.now() - lastActive.getTime()) / 86400000))
    : num(overrides.daysSinceLastActive);

  return {
    alertsCreated: num(overrides.alertsCreated, user?.monthlyActivity?.alertsCreated),
    bestMovesUsed: num(overrides.bestMovesUsed, user?.monthlyActivity?.bestMovesUsed),
    bestMoveActiveDays: num(overrides.bestMoveActiveDays, user?.monthlyActivity?.bestMoveActiveDays),
    savvyEarned: num(overrides.savvyEarned, user?.monthlyActivity?.savvyEarned),
    battlePassTier: num(overrides.battlePassTier, user?.monthlyActivity?.battlePassTier),
    currentStreak: num(overrides.currentStreak, user?.loginStreakDays),
    streakDaysClaimedThisMonth: num(
      overrides.streakDaysClaimedThisMonth,
      user?.monthlyActivity?.streakDaysClaimed
    ),
    eggsActivated: num(overrides.eggsActivated, user?.monthlyActivity?.eggsActivated),
    eggsCollected: num(overrides.eggsCollected, user?.dailyStreak?.scoutEggs?.common),
    loginDaysThisMonth: num(overrides.loginDaysThisMonth, user?.monthlyActivity?.loginDays),
    monthlyReportOpened: overrides.monthlyReportOpened ?? user?.monthlyActivity?.reportOpened ?? false,
    daysSinceLastActive,
    accountAgeDays,
    subscriptionTier: overrides.subscriptionTier || user?.subscription?.tier || user?.membershipTier,
    reportDate: overrides.reportDate,
    ...overrides,
  };
}

/** Realistic Premium-tier test snapshot for early report sends. */
function realisticPremiumTestActivity(overrides = {}) {
  return activitySnapshotFromUser(
    {},
    {
      alertsCreated: 12,
      bestMovesUsed: 47,
      bestMoveActiveDays: 8,
      savvyEarned: 2485,
      battlePassTier: 18,
      currentStreak: 34,
      streakDaysClaimedThisMonth: 22,
      eggsActivated: 2,
      eggsCollected: 4,
      loginDaysThisMonth: 22,
      monthlyReportOpened: true,
      daysSinceLastActive: 1,
      accountAgeDays: 120,
      subscriptionTier: 'core',
      ...overrides,
    }
  );
}

module.exports = {
  getMonthKey,
  monthLabelFromKey,
  generateMonthlyScoutGoals,
  hasClaimedMonthlyGoalsBonus,
  claimMonthlyGoalsCompletionBonus,
  activitySnapshotFromUser,
  realisticPremiumTestActivity,
  classifyUserSegment,
  resolveSubscriptionTier,
};
