const {
  generateMonthlyScoutGoals,
  activitySnapshotFromUser,
  monthLabelFromKey,
  getMonthKey,
} = require('./monthlyScoutGoalsService');
const { buildMonthlyScoutReportData } = require('./monthlyScoutReportDataService');

/**
 * Build full monthly report email payload from a user doc + optional overrides.
 * Prefer buildMonthlyScoutReportData(userId) for live per-user stats.
 */
function buildMonthlyReportPayload(user = {}, overrides = {}) {
  const activity = activitySnapshotFromUser(user, overrides);
  const scoutGoals = overrides.scoutGoals || generateMonthlyScoutGoals(user, activity);
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
    estimatedSavings: overrides.estimatedSavings ?? 0,
    membershipTier,
    scoutGoals,
    ...overrides,
  };
}

/**
 * @deprecated Use buildMonthlyScoutReportData(userId) for real user stats.
 * Kept for backwards-compatible imports; requires userId.
 */
async function buildEarlyMonthlyReportTestPayload(overrides = {}) {
  const userId = overrides.userId;
  if (!userId) {
    throw new Error('buildEarlyMonthlyReportTestPayload requires overrides.userId — use buildMonthlyScoutReportData');
  }
  return buildMonthlyScoutReportData(userId, {
    logMetrics: Boolean(overrides.logMetrics),
    monthKey: overrides.monthKey,
  });
}

module.exports = {
  buildMonthlyReportPayload,
  buildEarlyMonthlyReportTestPayload,
  buildMonthlyScoutReportData,
};
