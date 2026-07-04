/**
 * Scout Flight World Championship — monthly seasons, leaderboards, finalization, Hall of Champions.
 */

const User = require('../models/User');
const ScoutFlightRun = require('../models/ScoutFlightRun');
const ScoutFlightSeason = require('../models/ScoutFlightSeason');
const ScoutFlightChampionshipReward = require('../models/ScoutFlightChampionshipReward');
const {
  SEASON_STATUSES,
  getSeasonId,
  getUtcMonthStart,
  getUtcMonthEnd,
  formatSeasonName,
  resolveThemeKey,
  getTheme,
  getRewardTiers,
  resolveRewardTierForRank,
  getPrizePoolSavvy,
  getChampionshipMessaging,
  isBetaMode,
} = require('../config/scoutFlightChampionshipConfig');
const { grantSavvyReward } = require('./savvyRewardService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const { ensureEventInventory } = require('./scoutFlightTicketService');
const { getRewardTierPreview, RUN_TIMEOUT_MS } = require('../config/scoutFlightTournamentConfig');

class ScoutFlightChampionshipError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

function displayName(user) {
  if (!user) return 'Operator';
  return user.username || user.firstName || user.email?.split('@')[0] || 'Operator';
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

function buildEligibleRunMatch(season) {
  const match = {
    mode: 'tournament',
    status: 'completed',
    suspicious: { $ne: true },
    score: { $ne: null },
  };

  if (season) {
    match.$or = [
      { seasonId: season.seasonId },
      {
        seasonId: { $in: [null, ''] },
        completedAt: { $gte: season.startAt, $lt: season.endAt },
      },
    ];
  }

  return match;
}

async function aggregateSeasonLeaderboard(season, { limit = 100 } = {}) {
  const match = buildEligibleRunMatch(season);

  const entries = await ScoutFlightRun.aggregate([
    { $match: match },
    { $sort: { score: -1, completedAt: 1 } },
    {
      $group: {
        _id: '$userId',
        bestScore: { $first: '$score' },
        bestRunId: { $first: '$runId' },
        savvyEarnedSeason: { $sum: { $cond: [{ $eq: ['$savvyGranted', true] }, '$savvyEarned', 0] } },
        runsSubmitted: { $sum: 1 },
        completedAt: { $first: '$completedAt' },
        hasSuspiciousSibling: { $max: { $cond: ['$suspicious', 1, 0] } },
      },
    },
    { $sort: { bestScore: -1, completedAt: 1 } },
    { $limit: Math.min(100, Math.max(1, Number(limit) || 100)) },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        userId: '$_id',
        score: '$bestScore',
        bestRunId: 1,
        savvyEarnedSeason: 1,
        runsSubmitted: 1,
        completedAt: 1,
        username: {
          $ifNull: ['$user.username', { $ifNull: ['$user.firstName', 'Operator'] }],
        },
      },
    },
  ]);

  return entries.map((row, idx) => {
    const tier = resolveRewardTierForRank(idx + 1, season?.isBetaSeason);
    return {
      rank: idx + 1,
      userId: String(row.userId),
      username: row.username || 'Operator',
      score: row.score,
      bestRunId: row.bestRunId,
      runsSubmitted: row.runsSubmitted,
      savvyEarned: Number(row.savvyEarnedSeason) || 0,
      completedAt: row.completedAt,
      badge: tier?.title || null,
      rewardLabel: tier?.label || null,
    };
  });
}

async function getSeasonRankForUser(userId, season) {
  const rows = await aggregateSeasonLeaderboard(season, { limit: 100 });
  const entry = rows.find((r) => String(r.userId) === String(userId));
  if (entry) return { ...entry, totalPlayers: rows.length };

  const match = buildEligibleRunMatch(season);
  const myAgg = await ScoutFlightRun.aggregate([
    { $match: { ...match, userId } },
    {
      $group: {
        _id: '$userId',
        bestScore: { $max: '$score' },
        savvyEarnedSeason: { $sum: { $cond: [{ $eq: ['$savvyGranted', true] }, '$savvyEarned', 0] } },
        runsSubmitted: { $sum: 1 },
      },
    },
  ]);

  if (!myAgg.length) {
    return { rank: null, score: 0, runsSubmitted: 0, savvyEarned: 0, totalPlayers: rows.length };
  }

  const myScore = myAgg[0].bestScore;
  const higher = await ScoutFlightRun.aggregate([
    { $match: match },
    { $group: { _id: '$userId', bestScore: { $max: '$score' } } },
    { $match: { bestScore: { $gt: myScore } } },
    { $count: 'count' },
  ]);
  const rank = (higher[0]?.count || 0) + 1;

  return {
    rank,
    score: myScore,
    runsSubmitted: myAgg[0].runsSubmitted,
    savvyEarned: Number(myAgg[0].savvyEarnedSeason) || 0,
    totalPlayers: rows.length + (rank > rows.length ? 1 : 0),
  };
}

async function getSavvyEarnedThisSeason(userId, season) {
  const match = buildEligibleRunMatch(season);
  const agg = await ScoutFlightRun.aggregate([
    { $match: { ...match, userId } },
    {
      $group: {
        _id: null,
        total: { $sum: { $cond: [{ $eq: ['$savvyGranted', true] }, '$savvyEarned', 0] } },
      },
    },
  ]);
  return Number(agg[0]?.total) || 0;
}

async function createSeasonForMonth(date = new Date()) {
  const seasonId = getSeasonId(date);
  const beta = isBetaMode();
  const themeKey = resolveThemeKey(seasonId, beta);
  const theme = getTheme(themeKey);

  return ScoutFlightSeason.create({
    seasonId,
    name: formatSeasonName(seasonId, { isBetaSeason: beta }),
    themeKey,
    theme,
    startAt: getUtcMonthStart(date),
    endAt: getUtcMonthEnd(date),
    status: SEASON_STATUSES.ACTIVE,
    isBetaSeason: beta,
  });
}

async function finalizeSeasonRecord(season) {
  if (!season || season.status === SEASON_STATUSES.FINALIZED) return season;

  const leaderboard = await aggregateSeasonLeaderboard(season, { limit: 100 });
  let flaggedRunCount = 0;

  const suspiciousRuns = await ScoutFlightRun.countDocuments({
    seasonId: season.seasonId,
    mode: 'tournament',
    suspicious: true,
    status: 'completed',
  });
  flaggedRunCount = suspiciousRuns;

  let rewardCount = 0;
  const championRow = leaderboard[0] || null;

  for (const row of leaderboard) {
    const tier = resolveRewardTierForRank(row.rank, season.isBetaSeason);
    if (!tier) continue;

    const existing = await ScoutFlightChampionshipReward.findOne({
      seasonId: season.seasonId,
      userId: row.userId,
    });
    if (existing) continue;

    const idempotencyKey = `scout_flight_championship:${season.seasonId}:${row.userId}`;
    const user = await User.findById(row.userId);
    if (!user) continue;

    const cosmeticsGranted = [];
    let savvyGranted = 0;

    if (tier.savvy > 0) {
      const grant = await grantSavvyReward(user, {
        rewardType: 'scout_flight_championship',
        amount: tier.savvy,
        baseAmount: tier.savvy,
        idempotencyKey,
        note: `Scout Flight Championship ${season.name} — rank #${row.rank}`,
        meta: {
          seasonId: season.seasonId,
          rank: row.rank,
          score: row.score,
          source: 'scout_flight_championship',
        },
      });
      savvyGranted = grant.granted || grant.duplicate ? tier.savvy : 0;
    }

    if (tier.callingCardId) {
      const ok = await grantSystemCosmeticUnlock(user._id, tier.callingCardId, 'scout_flight_championship');
      if (ok) cosmeticsGranted.push({ itemId: tier.callingCardId, type: 'calling_card' });
    }
    if (tier.emblemId) {
      const ok = await grantSystemCosmeticUnlock(user._id, tier.emblemId, 'scout_flight_championship');
      if (ok) cosmeticsGranted.push({ itemId: tier.emblemId, type: 'emblem' });
    }
    if (tier.badgeId) {
      if (grantBadge(user, tier.badgeId)) {
        cosmeticsGranted.push({ itemId: tier.badgeId, type: 'badge' });
      }
    }

    const savvyAmount = tier.savvy || 0;
    const notifyTitle =
      row.rank === 1 ? '🏆 Scout Flight Champion' : `🏆 Scout Flight Season — #${row.rank}`;
    const notifyBody =
      row.rank === 1
        ? `You finished #1 this season and earned ${savvyAmount.toLocaleString()} Savvy.`
        : `You finished #${row.rank} in ${season.name} and earned ${savvyAmount > 0 ? `${savvyAmount.toLocaleString()} Savvy` : tier.label}.`;

    if (savvyAmount > 0 || cosmeticsGranted.length) {
      pushUserNotification(user, {
        kind: 'scout_flight_championship',
        title: notifyTitle,
        body: notifyBody,
      });
      await user.save();
    }

    await ScoutFlightChampionshipReward.create({
      seasonId: season.seasonId,
      userId: row.userId,
      rank: row.rank,
      score: row.score,
      runsSubmitted: row.runsSubmitted,
      savvyGranted: savvyGranted || tier.savvy,
      savvyIdempotencyKey: idempotencyKey,
      cosmeticsGranted,
      badgeId: tier.badgeId || null,
      title: tier.title || null,
      isBetaSeason: season.isBetaSeason,
      meta: { rewardLabel: tier.label },
    });

    rewardCount += 1;
  }

  if (championRow) {
    const tier = resolveRewardTierForRank(1, season.isBetaSeason);
    season.champion = {
      userId: championRow.userId,
      username: championRow.username,
      score: championRow.score,
      savvyEarned: tier?.savvy || 0,
      callingCardId: tier?.callingCardId || null,
      runId: championRow.bestRunId,
      recordedAt: new Date(),
    };
  }

  season.status = SEASON_STATUSES.FINALIZED;
  season.finalizedAt = new Date();
  season.rewardCount = rewardCount;
  season.flaggedRunCount = flaggedRunCount;
  await season.save();

  return season;
}

async function rolloverPendingSeasons(now = new Date()) {
  const currentStart = getUtcMonthStart(now);
  const stale = await ScoutFlightSeason.find({
    status: { $in: [SEASON_STATUSES.ACTIVE, SEASON_STATUSES.ENDED] },
    endAt: { $lte: currentStart },
  }).sort({ endAt: 1 });

  for (const season of stale) {
    await finalizeSeasonRecord(season);
  }
}

async function ensureCurrentSeason(now = new Date()) {
  await rolloverPendingSeasons(now);
  const seasonId = getSeasonId(now);
  let season = await ScoutFlightSeason.findOne({ seasonId });
  if (!season) {
    season = await createSeasonForMonth(now);
  } else if (season.status === SEASON_STATUSES.ACTIVE && now >= season.endAt) {
    season.status = SEASON_STATUSES.ENDED;
    await season.save();
    await finalizeSeasonRecord(season);
    season = await ScoutFlightSeason.findOne({ seasonId });
  }
  return season;
}

async function getCurrentSeason() {
  return ensureCurrentSeason();
}

async function getPreviousSeason() {
  const current = await ensureCurrentSeason();
  const prevStart = new Date(current.startAt);
  prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
  const prevId = getSeasonId(prevStart);
  let prev = await ScoutFlightSeason.findOne({ seasonId: prevId });
  if (!prev) {
    prev = await ScoutFlightSeason.findOne({
      seasonId: { $ne: current.seasonId },
      status: SEASON_STATUSES.FINALIZED,
    }).sort({ endAt: -1 });
  }
  return prev;
}

function msUntilSeasonEnd(season) {
  if (!season?.endAt) return 0;
  return Math.max(0, new Date(season.endAt).getTime() - Date.now());
}

async function getPersonalBest(userId) {
  const best = await ScoutFlightRun.findOne({
    userId,
    mode: 'tournament',
    status: 'completed',
    score: { $ne: null },
    suspicious: { $ne: true },
  })
    .sort({ score: -1 })
    .select('score completedAt')
    .lean();
  return best ? { score: best.score, completedAt: best.completedAt } : { score: 0, completedAt: null };
}

async function getActiveRun(userId) {
  const activeRun = await ScoutFlightRun.findOne({
    userId,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).lean();
  return activeRun
    ? {
        runId: activeRun.runId,
        startTime: activeRun.startTime,
        expiresAt: activeRun.expiresAt,
        msRemaining: Math.max(0, new Date(activeRun.expiresAt).getTime() - Date.now()),
      }
    : null;
}

async function getChampionshipDashboard(user) {
  const season = await ensureCurrentSeason();
  const previousSeason = await getPreviousSeason();
  const inv = ensureEventInventory(user);
  const ticketsOwned = Number(inv.scoutFlightTicket) || 0;
  const monthlyRank = await getSeasonRankForUser(user._id, season);
  const savvyEarnedSeason = await getSavvyEarnedThisSeason(user._id, season);
  const personalBest = await getPersonalBest(user._id);
  const rewardTiers = getRewardTiers(season.isBetaSeason);
  const messaging = getChampionshipMessaging(season.isBetaSeason);

  const currentLeaderboard = await aggregateSeasonLeaderboard(season, { limit: 50 });
  const currentUserEntry = currentLeaderboard.find((e) => String(e.userId) === String(user._id)) || {
    ...monthlyRank,
    userId: String(user._id),
    username: displayName(user),
    isCurrentUser: true,
  };

  return {
    season: {
      seasonId: season.seasonId,
      name: season.name,
      status: season.status,
      themeKey: season.themeKey,
      theme: season.theme,
      startAt: season.startAt,
      endAt: season.endAt,
      msRemaining: msUntilSeasonEnd(season),
      isBetaSeason: season.isBetaSeason,
      prizePoolSavvy: getPrizePoolSavvy(season.isBetaSeason),
    },
    previousSeason: previousSeason
      ? {
          seasonId: previousSeason.seasonId,
          name: previousSeason.name,
          status: previousSeason.status,
          champion: previousSeason.champion,
          finalizedAt: previousSeason.finalizedAt,
        }
      : null,
    ticketsOwned,
    personalBest,
    monthlyRank,
    savvyEarnedSeason,
    rewardTiers,
    messaging,
    leaderboard: {
      period: 'monthly',
      seasonId: season.seasonId,
      entries: currentLeaderboard.map((e) => ({
        ...e,
        isCurrentUser: String(e.userId) === String(user._id),
      })),
      currentUser: currentUserEntry,
    },
    activeRun: await getActiveRun(user._id),
    runTimeoutMs: RUN_TIMEOUT_MS,
    perRunRewardTiers: getRewardTierPreview(),
  };
}

async function getSeasonLeaderboard(seasonId, { userId, limit = 50 } = {}) {
  const season =
    (await ScoutFlightSeason.findOne({ seasonId })) ||
    (seasonId === (await ensureCurrentSeason()).seasonId ? await ensureCurrentSeason() : null);

  if (!season) {
    throw new ScoutFlightChampionshipError(404, 'SEASON_NOT_FOUND', 'Season not found.');
  }

  const entries = await aggregateSeasonLeaderboard(season, { limit });
  const currentUser = userId
    ? entries.find((e) => String(e.userId) === String(userId)) ||
      (await getSeasonRankForUser(userId, season))
    : null;

  return {
    season: {
      seasonId: season.seasonId,
      name: season.name,
      status: season.status,
      isBetaSeason: season.isBetaSeason,
      startAt: season.startAt,
      endAt: season.endAt,
      champion: season.champion,
      finalizedAt: season.finalizedAt,
    },
    period: 'monthly',
    entries: entries.map((e) => ({
      ...e,
      isCurrentUser: userId ? String(e.userId) === String(userId) : false,
    })),
    currentUser: currentUser
      ? {
          ...currentUser,
          userId: String(userId),
          isCurrentUser: true,
        }
      : null,
  };
}

async function getHallOfChampions({ limit = 50 } = {}) {
  const seasons = await ScoutFlightSeason.find({
    status: SEASON_STATUSES.FINALIZED,
    'champion.userId': { $ne: null },
  })
    .sort({ endAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 50)))
    .lean();

  return {
    records: seasons.map((s) => ({
      seasonId: s.seasonId,
      seasonName: s.name,
      themeKey: s.themeKey,
      theme: s.theme,
      isBetaSeason: s.isBetaSeason,
      champion: {
        userId: s.champion?.userId ? String(s.champion.userId) : null,
        username: s.champion?.username || 'Operator',
        score: s.champion?.score || 0,
        savvyEarned: s.champion?.savvyEarned || 0,
        callingCardId: s.champion?.callingCardId || null,
        runId: s.champion?.runId || null,
      },
      finalizedAt: s.finalizedAt,
      endAt: s.endAt,
    })),
  };
}

async function adminFinalizeSeason(seasonId) {
  const id = String(seasonId || '').trim();
  const season = await ScoutFlightSeason.findOne({ seasonId: id });
  if (!season) {
    throw new ScoutFlightChampionshipError(404, 'SEASON_NOT_FOUND', 'Season not found.');
  }
  if (season.status === SEASON_STATUSES.FINALIZED) {
    return { alreadyFinalized: true, season };
  }
  await finalizeSeasonRecord(season);
  return { alreadyFinalized: false, season: await ScoutFlightSeason.findOne({ seasonId: id }) };
}

async function adminDisqualifyRun(runId, reason = '') {
  const rid = String(runId || '').trim();
  if (!rid) {
    throw new ScoutFlightChampionshipError(400, 'RUN_REQUIRED', 'runId is required.');
  }
  const run = await ScoutFlightRun.findOne({ runId: rid });
  if (!run) {
    throw new ScoutFlightChampionshipError(404, 'RUN_NOT_FOUND', 'Run not found.');
  }
  run.status = 'disqualified';
  run.suspicious = true;
  run.suspiciousReason = String(reason || 'ADMIN_DISQUALIFIED').slice(0, 120);
  run.meta = { ...(run.meta || {}), disqualifiedAt: new Date(), disqualifiedReason: reason };
  await run.save();
  return { runId: run.runId, status: run.status, suspiciousReason: run.suspiciousReason };
}

async function attachSeasonToNewRun(runId, seasonId) {
  if (!runId || !seasonId) return;
  await ScoutFlightRun.updateOne({ runId }, { $set: { seasonId } });
}

module.exports = {
  ScoutFlightChampionshipError,
  ensureCurrentSeason,
  getCurrentSeason,
  getPreviousSeason,
  getChampionshipDashboard,
  getSeasonLeaderboard,
  getHallOfChampions,
  aggregateSeasonLeaderboard,
  getSeasonRankForUser,
  adminFinalizeSeason,
  adminDisqualifyRun,
  attachSeasonToNewRun,
  rolloverPendingSeasons,
  finalizeSeasonRecord,
  buildEligibleRunMatch,
};
