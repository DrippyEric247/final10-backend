const mongoose = require('mongoose');
const User = require('../models/User');
const Alert = require('../models/Alert');
const Auction = require('../models/Auction');
const SavvyTransaction = require('../models/SavvyTransaction');
const ReferralLog = require('../models/ReferralLog');
const BattlePassProgress = require('../models/BattlePassProgress');
const BattlePassEventLog = require('../models/BattlePassEventLog');
const EasterEggRedemption = require('../models/EasterEggRedemption');
const { DEFAULT_BATTLE_PASS_SEASON_ID } = require('../config/battlePassTrust');
const { isKnownCosmeticId } = require('../data/cosmeticIds');
const {
  getMonthKey,
  monthLabelFromKey,
  generateMonthlyScoutGoals,
  activitySnapshotFromUser,
  resolveSubscriptionTier,
} = require('./monthlyScoutGoalsService');
const {
  ensureCurrentSeason,
  getSeasonRankForUser,
} = require('./scoutFlightChampionshipService');
const { MONTHLY_GOALS_COMPLETION_BONUS } = require('../config/monthlyScoutGoals');

const LIGHT_ACTIVITY_MESSAGE =
  'Savvy Scout is still gathering your monthly data. Keep hunting to build next month\u2019s report.';

const USER_FIELDS =
  'username firstName email savvyPoints pointsBalance membershipTier premiumTier subscription loginStreakDays longestStreak monthlyActivity scoutMonthlyGoals dailyStreak perkMachine watchlist notifications createdAt lastActive';

function num(...values) {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

function getMonthBounds(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }
  return {
    start: new Date(y, m - 1, 1, 0, 0, 0, 0),
    end: new Date(y, m, 1, 0, 0, 0, 0),
  };
}

function isCurrentMonthlyActivity(user, monthKey) {
  return String(user?.monthlyActivity?.monthKey || '') === monthKey;
}

function monthlyActivityValue(user, monthKey, field) {
  if (!isCurrentMonthlyActivity(user, monthKey)) return null;
  const v = user?.monthlyActivity?.[field];
  return Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null;
}

function buildBonusExpiresLabel(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) return 'Reward available until the 15th of next month';
  const expires = new Date(y, m, 15);
  return `Reward available until ${expires.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function tierBonusKey(tier) {
  const t = String(tier || 'free').toLowerCase();
  if (t === 'pro' || t === 'elite') return 'pro';
  if (t === 'core' || t === 'premium') return 'premium';
  return 'free';
}

function membershipTierLabel(user) {
  const tier = resolveSubscriptionTier(user);
  if (tier === 'pro' || tier === 'elite') return 'Pro';
  if (tier === 'core') return 'Premium';
  if (String(user?.membershipTier || '').toLowerCase() === 'premium') return 'Premium';
  return 'Free';
}

function countWatchlistAdds(user, start, end) {
  const list = Array.isArray(user?.watchlist) ? user.watchlist : [];
  return list.filter((item) => {
    const at = item?.watchedAt ? new Date(item.watchedAt) : null;
    return at && at >= start && at < end;
  }).length;
}

function countEggsFromSpinHistory(user, start, end) {
  const history = user?.perkMachine?.spinHistory;
  if (!Array.isArray(history)) return 0;
  let total = 0;
  for (const spin of history) {
    const at = spin?.createdAt ? new Date(spin.createdAt) : null;
    if (!at || at < start || at >= end) continue;
    const rewards = spin?.rewards;
    if (!rewards || typeof rewards !== 'object') continue;
    for (const key of ['common', 'rare', 'epic', 'legendary', 'mythic']) {
      total += num(rewards[key], rewards?.scoutEggs?.[key], rewards?.eggs?.[key]);
    }
    if (Array.isArray(rewards.eggs)) total += rewards.eggs.length;
  }
  return total;
}

function countAlertMatchNotifications(user, start, end) {
  const notes = Array.isArray(user?.notifications) ? user.notifications : [];
  return notes.filter((n) => {
    if (n?.kind !== 'alert_match') return false;
    const at = n?.createdAt ? new Date(n.createdAt) : null;
    return at && at >= start && at < end;
  }).length;
}

async function countAlertsCreated(userId, start, end) {
  return Alert.countDocuments({
    user: userId,
    createdAt: { $gte: start, $lt: end },
  });
}

async function countAlertMatches(userId, start, end) {
  const rows = await Alert.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    { $unwind: '$matches' },
    {
      $match: {
        'matches.matchedAt': { $gte: start, $lt: end },
      },
    },
    { $count: 'count' },
  ]);
  return rows[0]?.count || 0;
}

async function sumSavvyEarnedThisMonth(userId, start, end) {
  const rows = await SavvyTransaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        status: 'completed',
        amount: { $gt: 0 },
        createdAt: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return Math.round(rows[0]?.total || 0);
}

async function sumEstimatedSavingsFromAlerts(userId, start, end) {
  const rows = await Alert.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    { $unwind: '$matches' },
    {
      $match: {
        'matches.matchedAt': { $gte: start, $lt: end },
      },
    },
    { $group: { _id: '$matches.auction' } },
  ]);

  const auctionIds = rows.map((r) => r._id).filter(Boolean);
  if (!auctionIds.length) return 0;

  const auctions = await Auction.find({ _id: { $in: auctionIds } })
    .select('savings marketValue originalPrice buyItNowPrice currentBid startingPrice')
    .lean();

  let total = 0;
  for (const auction of auctions) {
    const direct = Number(auction?.savings);
    if (Number.isFinite(direct) && direct > 0) {
      total += direct;
      continue;
    }
    const market = Number(
      auction?.marketValue ?? auction?.originalPrice ?? auction?.buyItNowPrice
    );
    const price = Number(auction?.currentBid ?? auction?.startingPrice);
    if (Number.isFinite(market) && Number.isFinite(price) && market > price) {
      total += market - price;
    }
  }
  return Math.round(total);
}

async function countReferralsThisMonth(userId, start, end) {
  return ReferralLog.countDocuments({
    referrerId: userId,
    status: 'accepted',
    createdAt: { $gte: start, $lt: end },
  });
}

async function countEggsRedeemedThisMonth(userId, start, end) {
  return EasterEggRedemption.countDocuments({
    userId,
    createdAt: { $gte: start, $lt: end },
  });
}

async function countCosmeticsUnlockedThisMonth(userId, start, end) {
  const logs = await BattlePassEventLog.find({
    userId,
    createdAt: { $gte: start, $lt: end },
  })
    .select('grantedRewards')
    .lean();

  let count = 0;
  for (const log of logs) {
    for (const grant of log.grantedRewards || []) {
      const cosmeticId =
        grant?.payload?.cosmeticId || grant?.cosmeticId || grant?.itemId || null;
      if (cosmeticId && isKnownCosmeticId(cosmeticId)) {
        count += 1;
      }
    }
  }
  return count;
}

async function loadBattlePassProgress(userId) {
  const doc = await BattlePassProgress.findOne({
    userId,
    seasonId: DEFAULT_BATTLE_PASS_SEASON_ID,
  })
    .select('tier xp')
    .lean();
  return {
    tier: num(doc?.tier),
    xp: num(doc?.xp),
  };
}

async function loadScoutFlightStats(userId) {
  try {
    const season = await ensureCurrentSeason();
    const rank = await getSeasonRankForUser(userId, season);
    return {
      seasonId: season.seasonId,
      seasonName: season.name,
      rank: rank?.rank ?? null,
      score: num(rank?.score),
      points: num(rank?.score),
      savvyEarned: num(rank?.savvyEarned),
      runsSubmitted: num(rank?.runsSubmitted),
      available: rank?.rank != null || rank?.runsSubmitted > 0,
    };
  } catch (err) {
    console.warn('[monthly-scout-report] scout flight stats unavailable:', err?.message);
    return {
      seasonId: null,
      seasonName: null,
      rank: null,
      score: 0,
      points: 0,
      savvyEarned: 0,
      runsSubmitted: 0,
      available: false,
    };
  }
}

function buildAchievements(metrics) {
  const achievements = [];
  if (metrics.currentStreak >= 30) {
    achievements.push({
      icon: '🔥',
      title: 'Streak Champion',
      description: `Maintained a ${metrics.currentStreak}-Day Streak`,
    });
  }
  if (metrics.eggsCollected >= 2) {
    achievements.push({
      icon: '🥚',
      title: 'Egg Collector',
      description: `Collected ${metrics.eggsCollected} Eggs this month`,
    });
  }
  if (metrics.battlePassTier >= 10) {
    achievements.push({
      icon: '🎟️',
      title: 'Battle Pass Veteran',
      description: `Reached Tier ${metrics.battlePassTier}`,
    });
  }
  if (metrics.scoutFlightRank != null && metrics.scoutFlightRank <= 10) {
    achievements.push({
      icon: '🏆',
      title: 'Scout Flight Contender',
      description: `Ranked #${metrics.scoutFlightRank} in Scout Flight`,
    });
  }
  if (metrics.referralsThisMonth >= 1) {
    achievements.push({
      icon: '🤝',
      title: 'Recruiter',
      description: `${metrics.referralsThisMonth} referral${metrics.referralsThisMonth === 1 ? '' : 's'} this month`,
    });
  }
  if (metrics.callingCardsEarned >= 1) {
    achievements.push({
      icon: '🎖️',
      title: 'Cosmetic Unlock',
      description: `Unlocked ${metrics.callingCardsEarned} calling card${metrics.callingCardsEarned === 1 ? '' : 's'} or emblem${metrics.callingCardsEarned === 1 ? '' : 's'}`,
    });
  }
  return achievements.slice(0, 6);
}

function isLightActivity(metrics) {
  const signal =
    metrics.savvyEarned +
    metrics.alertsCreated +
    metrics.bestMovesUsed +
    metrics.alertClicks +
    metrics.dealsSaved +
    metrics.eggsCollected +
    metrics.scoutGoalsCompleted +
    metrics.referralsThisMonth;
  return signal < 3 && metrics.loginDaysThisMonth < 3;
}

function buildScoutMessage(metrics, lightActivity) {
  if (lightActivity) return LIGHT_ACTIVITY_MESSAGE;
  const parts = ['Not bad, Operator.'];
  if (metrics.savvyEarned > 0) {
    parts.push(`You earned ${metrics.savvyEarned.toLocaleString('en-US')} Savvy this month.`);
  }
  if (metrics.estimatedSavings > 0) {
    parts.push(`Estimated savings: $${Math.round(metrics.estimatedSavings).toLocaleString('en-US')}.`);
  }
  if (metrics.currentStreak > 0) {
    parts.push(`Your login streak is ${metrics.currentStreak} days.`);
  }
  if (parts.length === 1) {
    parts.push('Keep hunting — next month\u2019s report is yours to earn.');
  } else {
    parts.push('Stay focused. See you on the next patrol.');
  }
  return parts.join(' ');
}

function buildRecommendationBody(user, activity, metrics) {
  const tier = resolveSubscriptionTier(user, activity);
  if (metrics.bestMovesUsed >= 10 && (tier === 'core' || tier === 'premium')) {
    return `You used ${metrics.bestMovesUsed} Best Moves this month. Upgrading to Pro unlocks unlimited Best Moves and higher event earnings.`;
  }
  if (metrics.alertsCreated === 0) {
    return 'Create Savvy Scout alerts to catch deals automatically and fill out next month\u2019s report.';
  }
  if (metrics.alertClicks > 0) {
    return `You acted on ${metrics.alertClicks} alert matches — keep alerts tuned for faster wins next month.`;
  }
  if (metrics.dealsSaved > 0) {
    return `You watchlisted ${metrics.dealsSaved} deal${metrics.dealsSaved === 1 ? '' : 's'} — set price alerts to strike when they drop.`;
  }
  return 'Log in daily, run Best Moves, and complete Scout Goals to maximize next month\u2019s report.';
}

function sumIncompleteGoalRewards(scoutGoals) {
  if (!scoutGoals?.goals?.length) return 0;
  return scoutGoals.goals
    .filter((g) => !g.completed)
    .reduce((sum, g) => sum + num(g.rewardSavvy), 0);
}

function logLoadedMetrics(userId, monthKey, metrics, sources) {
  console.info('[monthly-scout-report] metrics loaded', {
    userId: String(userId),
    monthKey,
    metrics,
    sources,
  });
}

/**
 * Build live Monthly Scout Report payload for a user (current calendar month).
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {{ logMetrics?: boolean, monthKey?: string }} [opts]
 */
async function buildMonthlyScoutReportData(userId, opts = {}) {
  if (!userId) {
    throw new Error('userId is required for buildMonthlyScoutReportData');
  }

  const user = await User.findById(userId).select(USER_FIELDS);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const monthKey = opts.monthKey || getMonthKey();
  const { start, end } = getMonthBounds(monthKey);
  const sources = {};

  const [
    alertsCreatedDb,
    alertMatchesDb,
    savvyEarnedDb,
    estimatedSavingsDb,
    referralsDb,
    eggsRedeemedDb,
    cosmeticsDb,
    battlePass,
    scoutFlight,
  ] = await Promise.all([
    countAlertsCreated(user._id, start, end),
    countAlertMatches(user._id, start, end),
    sumSavvyEarnedThisMonth(user._id, start, end),
    sumEstimatedSavingsFromAlerts(user._id, start, end),
    countReferralsThisMonth(user._id, start, end),
    countEggsRedeemedThisMonth(user._id, start, end),
    countCosmeticsUnlockedThisMonth(user._id, start, end),
    loadBattlePassProgress(user._id),
    loadScoutFlightStats(user._id),
  ]);

  const alertsCreated =
    alertsCreatedDb || monthlyActivityValue(user, monthKey, 'alertsCreated') || 0;
  sources.alertsCreated = alertsCreatedDb ? 'alerts_collection' : 'monthly_activity_or_zero';

  const bestMovesUsed = monthlyActivityValue(user, monthKey, 'bestMovesUsed') || 0;
  sources.bestMovesUsed = isCurrentMonthlyActivity(user, monthKey)
    ? 'monthly_activity'
    : 'zero_stale_month';

  const bestMoveActiveDays = monthlyActivityValue(user, monthKey, 'bestMoveActiveDays') || 0;

  const savvyEarned =
    savvyEarnedDb || monthlyActivityValue(user, monthKey, 'savvyEarned') || 0;
  sources.savvyEarned = savvyEarnedDb ? 'savvy_transactions' : 'monthly_activity_or_zero';

  const savvyBalance = num(user.savvyPoints, user.pointsBalance);
  sources.savvyBalance = 'user_wallet';

  const estimatedSavings = estimatedSavingsDb || 0;
  sources.estimatedSavings = estimatedSavingsDb ? 'alert_match_auctions' : 'zero';

  const alertClicks = Math.max(
    alertMatchesDb,
    countAlertMatchNotifications(user, start, end),
    0
  );
  sources.alertClicks = alertMatchesDb
    ? 'alert_matches'
    : 'notifications_or_zero';

  const dealsSaved = countWatchlistAdds(user, start, end);
  sources.dealsSaved = 'watchlist_watchedAt';

  const eggsFromActivity = monthlyActivityValue(user, monthKey, 'eggsActivated') || 0;
  const eggsFromSpins = countEggsFromSpinHistory(user, start, end);
  const eggsCollected = Math.max(eggsRedeemedDb, eggsFromActivity, eggsFromSpins, 0);
  sources.eggsCollected = eggsRedeemedDb
    ? 'easter_egg_redemptions'
    : eggsFromActivity
      ? 'monthly_activity'
      : eggsFromSpins
        ? 'perk_machine_spins'
        : 'zero';

  const battlePassTier =
    battlePass.tier || monthlyActivityValue(user, monthKey, 'battlePassTier') || 0;
  sources.battlePassTier = battlePass.tier ? 'battle_pass_progress' : 'monthly_activity_or_zero';

  const currentStreak = num(user.loginStreakDays);
  sources.currentStreak = 'user_login_streak';

  const loginDaysThisMonth = monthlyActivityValue(user, monthKey, 'loginDays') || 0;
  sources.loginDaysThisMonth = isCurrentMonthlyActivity(user, monthKey)
    ? 'monthly_activity'
    : 'zero_stale_month';

  const callingCardsEarned = cosmeticsDb || 0;
  sources.callingCardsEarned = cosmeticsDb ? 'battle_pass_event_log' : 'zero';

  const referralsThisMonth = referralsDb || 0;
  sources.referralsThisMonth = referralsDb ? 'referral_log' : 'zero';

  const activity = activitySnapshotFromUser(user, {
    alertsCreated,
    bestMovesUsed,
    bestMoveActiveDays,
    savvyEarned,
    battlePassTier,
    currentStreak,
    eggsActivated: eggsFromActivity,
    eggsCollected,
    loginDaysThisMonth,
    reportDate: `${monthKey}-15`,
  });

  const scoutGoals = generateMonthlyScoutGoals(user, activity);
  const scoutGoalsCompleted = num(scoutGoals.completedCount);
  const lightActivity = isLightActivity({
    savvyEarned,
    alertsCreated,
    bestMovesUsed,
    alertClicks,
    dealsSaved,
    eggsCollected,
    scoutGoalsCompleted,
    loginDaysThisMonth,
    referralsThisMonth,
  });

  const tier = resolveSubscriptionTier(user, activity);
  const bonusKey = tierBonusKey(tier);
  const monthlyBonusSavvy =
    MONTHLY_GOALS_COMPLETION_BONUS[bonusKey] || MONTHLY_GOALS_COMPLETION_BONUS.free;

  const metrics = {
    userName:
      String(user.firstName || '').trim() ||
      String(user.username || '').trim() ||
      'Operator',
    savvyEarned,
    savvyBalance,
    estimatedSavings,
    bestMovesUsed,
    alertsCreated,
    alertClicks,
    dealsSaved,
    scoutGoalsCompleted,
    eggsCollected,
    currentStreak,
    battlePassTier,
    battlePassXp: battlePass.xp,
    referralsThisMonth,
    callingCardsEarned,
    scoutFlightRank: scoutFlight.rank,
    scoutFlightPoints: scoutFlight.points,
    scoutFlightSavvyEarned: scoutFlight.savvyEarned,
    loginDaysThisMonth,
    lightActivity,
  };

  if (opts.logMetrics) {
    logLoadedMetrics(user._id, monthKey, metrics, sources);
  }

  const achievements = lightActivity ? [] : buildAchievements({
    currentStreak,
    eggsCollected,
    battlePassTier,
    scoutFlightRank: scoutFlight.rank,
    referralsThisMonth,
    callingCardsEarned,
  });

  const monthLabel = monthLabelFromKey(monthKey);

  return {
    userName:
      String(user.firstName || '').trim() ||
      String(user.username || '').trim() ||
      'Operator',
    monthLabel,
    monthKey,
    reportYear: Number(monthKey.split('-')[0]) || new Date().getFullYear(),
    savvyEarned,
    savvyBalance,
    bestMovesUsed,
    bestMoveActiveDays,
    alertsCreated,
    alertClicks,
    dealsSaved,
    currentStreak,
    battlePassTier,
    battlePassXp: battlePass.xp,
    battlePassProgress: battlePass.xp,
    eggsCollected,
    eggsActivated: eggsFromActivity,
    callingCardsEarned,
    estimatedSavings,
    referralsThisMonth,
    membershipTier: membershipTierLabel(user),
    subscriptionTier: tier,
    loginDaysThisMonth,
    scoutGoals,
    scoutGoalsCompleted,
    achievements,
    lightActivity,
    lightActivityMessage: LIGHT_ACTIVITY_MESSAGE,
    scoutGoalsMessage: lightActivity
      ? LIGHT_ACTIVITY_MESSAGE
      : scoutGoals.scoutGoalsMessage,
    scoutMessage: buildScoutMessage(metrics, lightActivity),
    recommendationLead: lightActivity
      ? 'Your patrol is just getting started:'
      : 'Based on your activity this month:',
    recommendationBody: lightActivity
      ? LIGHT_ACTIVITY_MESSAGE
      : buildRecommendationBody(user, activity, metrics),
    potentialExtraSavvy: sumIncompleteGoalRewards(scoutGoals),
    monthlyBonusSavvy,
    bonusExpiresLabel: buildBonusExpiresLabel(monthKey),
    scoutFlight,
    metrics,
    sources,
  };
}

module.exports = {
  LIGHT_ACTIVITY_MESSAGE,
  buildMonthlyScoutReportData,
  getMonthBounds,
};
