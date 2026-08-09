/**
 * Scout Flight Tournament Mode — server-authoritative tickets, runs, scores, rewards.
 */

const crypto = require('crypto');
const ScoutFlightRun = require('../models/ScoutFlightRun');
const {
  RUN_TIMEOUT_MS,
  MIN_RUN_MS,
  MAX_SCORE,
  MAX_SCORE_PER_SECOND,
  resolveSavvyForScore,
  getRewardTierPreview,
  getPeriodStart,
  getUtcDayKey,
} = require('../config/scoutFlightTournamentConfig');
const { grantSavvyReward } = require('./savvyRewardService');
const { ensureEventInventory } = require('./scoutFlightTicketService');

function getChampionshipHelpers() {
  return require('./scoutFlightChampionshipService');
}

class ScoutFlightTournamentError extends Error {
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

async function expireStaleRuns(userId) {
  const now = new Date();
  await ScoutFlightRun.updateMany(
    { userId, status: 'active', expiresAt: { $lt: now } },
    { $set: { status: 'expired' } }
  );
}

async function getActiveRun(userId) {
  await expireStaleRuns(userId);
  return ScoutFlightRun.findOne({
    userId,
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).lean();
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

async function getDailyRank(userId) {
  const dayStart = getPeriodStart('daily');
  const match = {
    mode: 'tournament',
    status: 'completed',
    completedAt: { $gte: dayStart },
    score: { $ne: null },
    suspicious: { $ne: true },
  };

  const myAgg = await ScoutFlightRun.aggregate([
    { $match: { ...match, userId } },
    { $group: { _id: '$userId', bestScore: { $max: '$score' } } },
  ]);

  if (!myAgg.length) {
    return { rank: null, score: 0, totalPlayers: 0 };
  }

  const myScore = myAgg[0].bestScore;
  const leaderboard = await ScoutFlightRun.aggregate([
    { $match: match },
    { $group: { _id: '$userId', bestScore: { $max: '$score' } } },
    { $sort: { bestScore: -1 } },
  ]);

  const rank = leaderboard.findIndex((r) => String(r._id) === String(userId)) + 1;
  return {
    rank: rank > 0 ? rank : null,
    score: myScore,
    totalPlayers: leaderboard.length,
  };
}

async function getTournamentStatus(user) {
  const inv = ensureEventInventory(user);
  const ticketsOwned = Number(inv.scoutFlightTicket) || 0;
  const activeRun = await getActiveRun(user._id);
  const personalBest = await getPersonalBest(user._id);
  const dailyRank = await getDailyRank(user._id);
  let monthlyRank = { rank: null, score: 0, totalPlayers: 0 };
  try {
    const { ensureCurrentSeason, getSeasonRankForUser } = getChampionshipHelpers();
    const season = await ensureCurrentSeason();
    monthlyRank = await getSeasonRankForUser(user._id, season);
  } catch {
    /* championship module optional at boot */
  }

  return {
    ticketsOwned,
    ticketLabel: 'Scout Flight Ticket',
    ticketIcon: '🎟️',
    ticketDescription:
      'Use this ticket to enter official Scout Flight Tournament Mode and compete for Savvy Points.',
    activeRun: activeRun
      ? {
          runId: activeRun.runId,
          startTime: activeRun.startTime,
          expiresAt: activeRun.expiresAt,
          msRemaining: Math.max(0, new Date(activeRun.expiresAt).getTime() - Date.now()),
        }
      : null,
    personalBest,
    dailyRank,
    monthlyRank,
    rewardTiers: getRewardTierPreview(),
    runTimeoutMs: RUN_TIMEOUT_MS,
  };
}

function validateScoreSubmission(score, elapsedMs, run) {
  const n = Math.round(Number(score) || 0);
  if (!Number.isFinite(n) || n < 0 || n > MAX_SCORE) {
    return { valid: false, code: 'SCORE_OUT_OF_RANGE', reason: 'Score out of allowed range.' };
  }

  const serverElapsed = Math.max(0, Date.now() - new Date(run.startTime).getTime());
  const clientElapsed = Math.max(0, Number(elapsedMs) || 0);
  const elapsed = Math.min(clientElapsed || serverElapsed, serverElapsed);

  if (elapsed < MIN_RUN_MS && n > 50) {
    return { valid: false, code: 'RUN_TOO_SHORT', reason: 'Run completed too quickly for this score.' };
  }

  const seconds = Math.max(elapsed / 1000, 0.5);
  const rate = n / seconds;
  const suspicious = rate > MAX_SCORE_PER_SECOND;

  if (suspicious && rate > MAX_SCORE_PER_SECOND * 2) {
    return {
      valid: false,
      code: 'SCORE_IMPLAUSIBLE',
      reason: 'Score could not be verified for this run.',
    };
  }

  return {
    valid: true,
    elapsed,
    suspicious,
    suspiciousReason: suspicious ? 'SCORE_RATE_HIGH' : null,
  };
}

async function startTournamentRun(user) {
  await expireStaleRuns(user._id);

  const existing = await ScoutFlightRun.findOne({
    userId: user._id,
    status: 'active',
    expiresAt: { $gt: new Date() },
  });

  if (existing) {
    return {
      runId: existing.runId,
      resumed: true,
      ticketSpent: false,
      expiresAt: existing.expiresAt,
      startTime: existing.startTime,
      status: await getTournamentStatus(user),
    };
  }

  const inv = ensureEventInventory(user);
  const tickets = Number(inv.scoutFlightTicket) || 0;
  if (tickets < 1) {
    throw new ScoutFlightTournamentError(
      400,
      'NO_TICKETS',
      'You need a Scout Flight Ticket to enter Tournament Mode.'
    );
  }

  inv.scoutFlightTicket = tickets - 1;
  user.markModified('eventInventory');

  const runId = crypto.randomUUID();
  const startTime = new Date();
  const expiresAt = new Date(startTime.getTime() + RUN_TIMEOUT_MS);
  let seasonId = null;
  try {
    const { ensureCurrentSeason } = getChampionshipHelpers();
    const season = await ensureCurrentSeason();
    seasonId = season.seasonId;
  } catch {
    /* ignore */
  }

  await ScoutFlightRun.create({
    runId,
    userId: user._id,
    mode: 'tournament',
    status: 'active',
    ticketSpent: true,
    startTime,
    expiresAt,
    seasonId,
  });

  await user.save();

  return {
    runId,
    resumed: false,
    ticketSpent: true,
    expiresAt,
    startTime,
    status: await getTournamentStatus(user),
  };
}

async function submitTournamentScore(user, { runId, score, elapsedMs }) {
  const rid = String(runId || '').trim();
  if (!rid) {
    throw new ScoutFlightTournamentError(400, 'RUN_REQUIRED', 'Tournament run ID is required.');
  }

  await expireStaleRuns(user._id);

  const run = await ScoutFlightRun.findOne({ runId: rid, userId: user._id });
  if (!run) {
    throw new ScoutFlightTournamentError(404, 'RUN_NOT_FOUND', 'Tournament run not found.');
  }

  if (run.status === 'completed') {
    return {
      duplicate: true,
      runId: run.runId,
      score: run.score,
      savvyEarned: run.savvyEarned,
      savvyGranted: run.savvyGranted,
      personalBest: await getPersonalBest(user._id),
      dailyRank: await getDailyRank(user._id),
      status: await getTournamentStatus(user),
    };
  }

  if (run.status !== 'active') {
    throw new ScoutFlightTournamentError(
      400,
      'RUN_NOT_ACTIVE',
      run.status === 'expired'
        ? 'This tournament run expired. Start a new run with a ticket.'
        : 'This tournament run is no longer valid.'
    );
  }

  if (new Date(run.expiresAt).getTime() < Date.now()) {
    run.status = 'expired';
    await run.save();
    throw new ScoutFlightTournamentError(400, 'RUN_EXPIRED', 'This tournament run expired.');
  }

  const validation = validateScoreSubmission(score, elapsedMs, run);
  if (!validation.valid) {
    run.status = 'invalid';
    run.suspicious = true;
    run.suspiciousReason = validation.code;
    run.completedAt = new Date();
    await run.save();
    throw new ScoutFlightTournamentError(400, validation.code, validation.reason);
  }

  const finalScore = Math.round(Number(score) || 0);
  const savvyEarned = resolveSavvyForScore(finalScore);
  const idempotencyKey = `scout_flight_tournament:${run.runId}`;

  run.score = finalScore;
  run.savvyEarned = savvyEarned;
  run.elapsedMs = validation.elapsed;
  run.suspicious = validation.suspicious;
  run.suspiciousReason = validation.suspiciousReason;
  run.completedAt = new Date();
  run.status = 'completed';
  run.submitIdempotencyKey = idempotencyKey;

  let savvyGranted = false;
  let newBalance = Math.round(Number(user.savvyPoints) || 0);

  if (savvyEarned > 0 && !validation.suspicious) {
    const grant = await grantSavvyReward(user, {
      rewardType: 'scout_flight_tournament',
      amount: savvyEarned,
      baseAmount: savvyEarned,
      idempotencyKey,
      note: `Scout Flight Tournament — score ${finalScore}`,
      meta: { runId: run.runId, score: finalScore, source: 'scout_flight_tournament' },
    });
    savvyGranted = grant.granted || grant.duplicate;
    newBalance = grant.newBalance;
    run.savvyGranted = savvyGranted;
  } else {
    run.savvyGranted = false;
  }

  await run.save();
  await user.save();

  const { fireContractTrigger } = require('./contractHooks');
  fireContractTrigger(user._id, 'scout_flight_run');

  const personalBest = await getPersonalBest(user._id);
  const dailyRank = await getDailyRank(user._id);
  let monthlyRank = { rank: null, score: 0, totalPlayers: 0 };
  try {
    const { ensureCurrentSeason, getSeasonRankForUser } = getChampionshipHelpers();
    const season = await ensureCurrentSeason();
    monthlyRank = await getSeasonRankForUser(user._id, season);
  } catch {
    /* ignore */
  }
  const isNewPersonalBest = finalScore > 0 && finalScore >= personalBest.score;

  return {
    duplicate: false,
    runId: run.runId,
    score: finalScore,
    savvyEarned,
    savvyGranted,
    savvyBalance: newBalance,
    suspicious: run.suspicious,
    personalBest,
    isNewPersonalBest,
    dailyRank,
    monthlyRank,
    status: await getTournamentStatus(user),
  };
}

async function getLeaderboard(period, { userId, limit = 50, seasonId = null } = {}) {
  const periodKey = String(period || 'daily').toLowerCase();

  if (periodKey === 'monthly' || periodKey === 'month') {
    const { getSeasonLeaderboard, ensureCurrentSeason } = getChampionshipHelpers();
    const sid = seasonId || (await ensureCurrentSeason()).seasonId;
    return getSeasonLeaderboard(sid, { userId, limit });
  }

  const since = getPeriodStart(periodKey);
  const match = {
    mode: 'tournament',
    status: 'completed',
    score: { $ne: null },
    suspicious: { $ne: true },
  };
  if (since) match.completedAt = { $gte: since };

  const entries = await ScoutFlightRun.aggregate([
    { $match: match },
    { $sort: { score: -1, completedAt: 1 } },
    {
      $group: {
        _id: '$userId',
        bestScore: { $first: '$score' },
        savvyEarned: { $sum: { $cond: [{ $eq: ['$savvyGranted', true] }, '$savvyEarned', 0] } },
        runsSubmitted: { $sum: 1 },
        completedAt: { $first: '$completedAt' },
        runId: { $first: '$runId' },
      },
    },
    { $sort: { bestScore: -1, completedAt: 1 } },
    { $limit: Math.min(100, Math.max(1, Number(limit) || 50)) },
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
        savvyEarned: 1,
        completedAt: 1,
        runId: 1,
        username: {
          $ifNull: ['$user.username', { $ifNull: ['$user.firstName', 'Operator'] }],
        },
      },
    },
  ]);

  const rows = entries.map((row, idx) => ({
    rank: idx + 1,
    userId: String(row.userId),
    username: row.username || 'Operator',
    score: row.bestScore ?? row.score,
    savvyEarned: Number(row.savvyEarned) || 0,
    runsSubmitted: Number(row.runsSubmitted) || 1,
    bestRunId: row.runId,
    completedAt: row.completedAt,
    isCurrentUser: userId ? String(row.userId) === String(userId) : false,
  }));

  let currentUserEntry = null;
  if (userId) {
    currentUserEntry = rows.find((r) => r.isCurrentUser) || null;
    if (!currentUserEntry) {
      const myBest = await ScoutFlightRun.findOne({
        userId,
        mode: 'tournament',
        status: 'completed',
        ...(since ? { completedAt: { $gte: since } } : {}),
        score: { $ne: null },
      })
        .sort({ score: -1 })
        .lean();
      if (myBest) {
        const higher = await ScoutFlightRun.countDocuments({
          mode: 'tournament',
          status: 'completed',
          ...(since ? { completedAt: { $gte: since } } : {}),
          score: { $gt: myBest.score },
        });
        const userDoc = await require('../models/User').findById(userId).select('username firstName').lean();
        currentUserEntry = {
          rank: higher + 1,
          userId: String(userId),
          username: displayName(userDoc),
        score: myBest.score,
        savvyEarned: myBest.savvyEarned || 0,
        runsSubmitted: 1,
        bestRunId: myBest.runId,
        completedAt: myBest.completedAt,
          isCurrentUser: true,
        };
      }
    }
  }

  return {
    period: periodKey,
    dayKey: getUtcDayKey(),
    entries: rows,
    currentUser: currentUserEntry,
  };
}

async function adminGrantTicket(user, count = 1) {
  const inv = ensureEventInventory(user);
  const qty = Math.max(1, Math.min(50, Number(count) || 1));
  inv.scoutFlightTicket = Number(inv.scoutFlightTicket) + qty;
  user.markModified('eventInventory');
  await user.save();
  return {
    granted: qty,
    ticketsOwned: inv.scoutFlightTicket,
    status: await getTournamentStatus(user),
  };
}

module.exports = {
  ScoutFlightTournamentError,
  getTournamentStatus,
  startTournamentRun,
  submitTournamentScore,
  getLeaderboard,
  adminGrantTicket,
  expireStaleRuns,
  resolveSavvyForScore,
};
