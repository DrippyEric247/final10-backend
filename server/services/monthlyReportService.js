const {
  generateMonthlyScoutGoals,
  activitySnapshotFromUser,
  realisticPremiumTestActivity,
  monthLabelFromKey,
  getMonthKey,
} = require('./monthlyScoutGoalsService');

/**
 * Build full monthly report email payload for a user (or test overrides).
 */
function buildMonthlyReportPayload(user = {}, overrides = {}) {
  const activity = activitySnapshotFromUser(user, overrides);
  const scoutGoals = generateMonthlyScoutGoals(user, activity);
  const monthKey = overrides.monthKey || scoutGoals.monthKey || getMonthKey();
  const monthLabel = overrides.monthLabel || monthLabelFromKey(monthKey);

  const firstName = String(user?.firstName || '').trim();
  const userName =
    overrides.userName ||
    firstName ||
    String(user?.username || '').trim() ||
    'Operator';

  const membershipTier =
    overrides.membershipTier ||
    scoutGoals.tierLabel ||
    'Free';

  return {
    userName,
    monthLabel,
    monthKey,
    reportYear: Number(monthKey.split('-')[0]) || new Date().getFullYear(),
    savvyEarned: activity.savvyEarned,
    bestMovesUsed: activity.bestMovesUsed,
    alertsCreated: activity.alertsCreated,
    alertClicks: overrides.alertClicks ?? activity.alertClicks ?? 0,
    currentStreak: activity.currentStreak,
    battlePassTier: activity.battlePassTier,
    eggsCollected: activity.eggsCollected ?? overrides.eggsCollected ?? 0,
    callingCardsEarned: overrides.callingCardsEarned ?? 0,
    estimatedSavings: overrides.estimatedSavings ?? 327,
    membershipTier,
    scoutGoals,
    ...overrides,
  };
}

/** Early test report — realistic Premium stats + dynamic goals for Eric. */
function buildEarlyMonthlyReportTestPayload(overrides = {}) {
  const activity = realisticPremiumTestActivity(overrides);
  const mockUser = {
    firstName: 'Eric',
    membershipTier: 'premium',
    subscription: { tier: 'core' },
    scoutMonthlyGoals: { completionBonusClaimedMonths: [] },
  };
  return buildMonthlyReportPayload(mockUser, {
    userName: 'Eric',
    monthLabel: monthLabelFromKey(getMonthKey()),
    alertClicks: 31,
    callingCardsEarned: 2,
    estimatedSavings: 327,
    monthlyBonusSavvy: 100,
    bonusExpiresLabel: `Reward available until ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 15).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    potentialExtraSavvy: 420,
    achievements: [
      { icon: '🔥', title: 'Streak Champion', description: 'Maintained a 30+ Day Streak' },
      { icon: '🥚', title: 'Egg Collector', description: 'Collected multiple Eggs this month' },
      { icon: '🎟️', title: 'Battle Pass Veteran', description: 'Reached Tier 18' },
      { icon: '🏆', title: 'Top 10% User', description: "You're in the Top 10% of Savvy Earners!" },
    ],
    ...activity,
    ...overrides,
  });
}

module.exports = {
  buildMonthlyReportPayload,
  buildEarlyMonthlyReportTestPayload,
};
