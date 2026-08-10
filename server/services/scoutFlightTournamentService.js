/**
 * Scout Flight Tournament Mode — server-authoritative tickets, runs, scores, rewards.
 */

const crypto = require('crypto');
const ScoutFlightRun = require('../models/ScoutFlightRun');
const {
  RUN_TIMEOUT_MS,
  MIN_RUN_MS,
  MAX_SCORE_ABSOLUTE,
  MAX_SCORE_PER_SECOND,
  resolveMaxScoreForElapsed,
  resolveSavvyForScore,
  getRewardTierPreview,
  getPeriodStart,
  getUtcDayKey,
} = require('../config/scoutFlightTournamentConfig');
const {
  MAX_NUKE_FLIGHT_MULTIPLIER,
  MAX_NUKE_SURVIVAL_MS,
  MAX_STACKED_RUN_MULTIPLIER,
  NUKE_CLOCK_TOLERANCE_MS,
  NUKE_MULTIPLIER_START,
  NUKE_TRIGGER_MS,
  SCORE_RECONSTRUCTION_TOLERANCE_ABSOLUTE,
  SCORE_RECONSTRUCTION_TOLERANCE_RATIO,
  resolveMaxNukeBonusScore,
  resolveNukeMultiplier,
  resolveNukeSavvyBonus,
  resolveObstacleCountBounds,
} = require('../config/scoutFlightNukeConfig');
const {
  deriveNukeSurvivalMs,
  deriveServerNukeMultiplier,
  evaluateRunEvidence,
  recordHeartbeat,
} = require('./scoutFlightHeartbeatService');
const { logScoutFlightValidation } = require('./scoutFlightValidationLog');
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

function validateScoreSubmission(score, elapsedMs, run, baseScoreInput) {
  const total = Math.round(Number(score) || 0);
  if (!Number.isFinite(total) || total < 0) {
    return { valid: false, code: 'SCORE_OUT_OF_RANGE', reason: 'Score out of allowed range.' };
  }

  const serverElapsed = Math.max(0, Date.now() - new Date(run.startTime).getTime());
  const clientElapsed = Math.max(0, Number(elapsedMs) || 0);
  // Client time can only ever shorten the run, never extend it past wall clock.
  const elapsed = Math.min(clientElapsed || serverElapsed, serverElapsed);

  // Every limit below is applied to the base score. The Nuke bonus is validated
  // separately against the multiplier curve and then added back by the caller,
  // so an inflated client total can never widen these bounds.
  const rawBase = Number(baseScoreInput);
  const base = Number.isFinite(rawBase) && rawBase >= 0 ? Math.min(Math.round(rawBase), total) : total;

  if (base > resolveMaxScoreForElapsed(elapsed)) {
    return { valid: false, code: 'SCORE_OUT_OF_RANGE', reason: 'Score out of allowed range.' };
  }

  if (elapsed < MIN_RUN_MS && base > 50) {
    return { valid: false, code: 'RUN_TOO_SHORT', reason: 'Run completed too quickly for this score.' };
  }

  const seconds = Math.max(elapsed / 1000, 0.5);
  const rate = base / seconds;
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
    baseScore: base,
    claimedTotal: total,
    suspicious,
    suspiciousReason: suspicious ? 'SCORE_RATE_HIGH' : null,
  };
}

/**
 * Validates a claimed Nuke Flight Streak against the server's own view of the run.
 *
 * Nuke eligibility is never taken from a client flag: it must be consistent with
 * the wall-clock run duration, the multiplier curve, and the base score. A claim
 * that contradicts the server clock is treated as cheating (`impossible`); one
 * that is merely inconsistent loses the bonus but keeps the base payout.
 *
 * @returns {{ triggered: boolean, survivalMs?: number, highestMultiplier?: number,
 *   bonusScore?: number, obstaclesEscaped?: number, structuresDestroyed?: number,
 *   rejected?: boolean, rejectedReason?: string, impossible?: boolean }}
 */
function isSubstantiveNukeClaim(claim) {
  if (!claim || typeof claim !== 'object') return false;
  if (claim.nukeActive === true && Object.keys(claim).length === 1) return false;

  const hasSurvival =
    claim.nukeSurvivalMs != null && Number.isFinite(Number(claim.nukeSurvivalMs));
  const hasBonus = Math.round(Number(claim.bonusScore) || 0) > 0;
  const hasObstacles = Math.round(Number(claim.obstaclesEscaped) || 0) > 0;
  const hasStructures = Math.round(Number(claim.structuresDestroyed) || 0) > 0;
  const hasMultiplier = Math.round(Number(claim.highestMultiplier) || 0) > 0;

  return hasSurvival || hasBonus || hasObstacles || hasStructures || hasMultiplier;
}

function validateNukeClaim(claim, validation, run, evidenceEval) {
  if (!claim || typeof claim !== 'object') return { triggered: false };
  if (!isSubstantiveNukeClaim(claim)) return { triggered: false };

  const reject = (reason, impossible = false) => ({
    triggered: false,
    rejected: true,
    rejectedReason: reason,
    impossible,
  });

  const serverElapsed = Math.max(0, Date.now() - new Date(run.startTime).getTime());
  const evidence = evidenceEval || evaluateRunEvidence(run, validation.elapsed);

  if (serverElapsed + NUKE_CLOCK_TOLERANCE_MS < NUKE_TRIGGER_MS) {
    return reject('NUKE_BEFORE_THRESHOLD', true);
  }
  if (validation.elapsed + NUKE_CLOCK_TOLERANCE_MS < NUKE_TRIGGER_MS) {
    return reject('NUKE_ACTIVE_TIME_TOO_SHORT', true);
  }

  if (evidence.impossible) {
    const primary = evidence.issues.find((i) => i.impossible)?.code || 'EVIDENCE_INVALID';
    return reject(primary, true);
  }

  const survivalMs = deriveNukeSurvivalMs(validation, claim);
  if (!Number.isFinite(survivalMs) || survivalMs < 0 || survivalMs > MAX_NUKE_SURVIVAL_MS) {
    return reject('NUKE_SURVIVAL_OUT_OF_RANGE', true);
  }

  const serverMultiplier = deriveServerNukeMultiplier(survivalMs);
  const claimedMultiplier = Math.round(Number(claim.highestMultiplier) || 0);
  const highestMultiplier = serverMultiplier;
  const multiplierAdjusted =
    claimedMultiplier > 0 && claimedMultiplier > serverMultiplier;

  const clampCount = (value) => {
    const n = Math.round(Number(value) || 0);
    return n > 0 && Number.isFinite(n) ? n : 0;
  };

  const claimObstacles = clampCount(claim.obstaclesEscaped);
  const obstacleCount = Math.max(evidence.obstacleCount, claimObstacles);
  const bounds = evidence.bounds || resolveObstacleCountBounds(validation.elapsed);

  if (obstacleCount < bounds.min) {
    return reject('NUKE_GAMEPLAY_EVIDENCE_MISSING', true);
  }
  if (obstacleCount > bounds.max) {
    return reject('OBSTACLE_EVIDENCE_HIGH', true);
  }

  const serverBase = Math.min(
    validation.baseScore,
    evidence.evidence?.maxBaseScoreSeen > 0
      ? evidence.evidence.maxBaseScoreSeen
      : validation.baseScore
  );
  const bonusScore = Math.min(
    Math.max(0, Math.round(Number(claim.bonusScore) || 0)),
    resolveMaxNukeBonusScore(serverBase, highestMultiplier)
  );

  if (evidence.strictReview) {
    return {
      triggered: true,
      survivalMs,
      highestMultiplier,
      bonusScore,
      obstaclesEscaped: obstacleCount,
      structuresDestroyed: clampCount(claim.structuresDestroyed),
      rejected: true,
      rejectedReason: evidence.issues.find((i) => i.strict)?.code || 'STRICT_REVIEW',
      strictReview: true,
      multiplierAdjusted,
    };
  }

  return {
    triggered: true,
    survivalMs,
    highestMultiplier,
    bonusScore,
    obstaclesEscaped: obstacleCount,
    structuresDestroyed: clampCount(claim.structuresDestroyed),
    rejected: false,
    rejectedReason: null,
    multiplierAdjusted,
  };
}

/**
 * Rebuilds the authoritative final score from validated base + Nuke bonus.
 * Uses heartbeat evidence when available; logs meaningful discrepancies.
 */
function reconstructFinalScore(validation, nukeResult, run, submittedTotal) {
  const evidence = run?.evidence || {};
  const heartbeatBase =
    evidence.maxBaseScoreSeen > 0 ? evidence.maxBaseScoreSeen : validation.baseScore;
  const serverBase = Math.min(validation.baseScore, heartbeatBase);

  let nukeBonus = 0;
  if (nukeResult.triggered && !nukeResult.rejected) {
    nukeBonus = Math.min(
      nukeResult.bonusScore || 0,
      resolveMaxNukeBonusScore(serverBase, nukeResult.highestMultiplier)
    );
  }

  const reconstructed = Math.min(MAX_SCORE_ABSOLUTE, serverBase + nukeBonus);
  const submitted = Math.round(Number(submittedTotal) || 0);
  const diff = Math.abs(reconstructed - submitted);
  const tolerance = Math.max(
    SCORE_RECONSTRUCTION_TOLERANCE_ABSOLUTE,
    reconstructed * SCORE_RECONSTRUCTION_TOLERANCE_RATIO
  );

  return {
    finalScore: reconstructed,
    serverBase,
    nukeBonus,
    adjusted: diff > tolerance,
    submitted,
  };
}

async function processRunHeartbeat(user, payload) {
  const rid = String(payload?.runId || '').trim();
  if (!rid) {
    throw new ScoutFlightTournamentError(400, 'RUN_REQUIRED', 'Tournament run ID is required.');
  }

  const run = await ScoutFlightRun.findOne({ runId: rid, userId: user._id });
  if (!run) {
    throw new ScoutFlightTournamentError(404, 'RUN_NOT_FOUND', 'Tournament run not found.');
  }

  if (run.status !== 'active') {
    throw new ScoutFlightTournamentError(400, 'RUN_NOT_ACTIVE', 'This tournament run is not active.');
  }

  const result = await recordHeartbeat(run, payload);
  if (!result.ok) {
    throw new ScoutFlightTournamentError(400, result.code, 'Heartbeat could not be verified.');
  }

  return {
    ok: true,
    sequence: result.evidence?.lastSequence,
    heartbeatCount: result.evidence?.heartbeatCount,
    isTestRun: Boolean(run.isTestRun),
  };
}

async function adminStartTestRun(user) {
  await expireStaleRuns(user._id);

  const runId = crypto.randomUUID();
  const startTime = new Date();
  const expiresAt = new Date(startTime.getTime() + RUN_TIMEOUT_MS);

  await ScoutFlightRun.create({
    runId,
    userId: user._id,
    mode: 'tournament',
    status: 'active',
    ticketSpent: false,
    isTestRun: true,
    startTime,
    expiresAt,
    seasonId: null,
  });

  return {
    runId,
    isTestRun: true,
    expiresAt,
    startTime,
    message: 'Test run started — visuals only, zero Savvy payout.',
  };
}

/**
 * Client-safe Nuke result. Deliberately omits the internal rejection reason so
 * validation thresholds are not advertised to players.
 */
function formatRunNukeResult(run) {
  const n = run?.nuke;
  if (!n || (!n.triggered && !n.rejected)) return null;
  const baseSavvy = run.savvyGranted ? Math.round(Number(run.savvyEarned) || 0) : 0;
  const bonusSavvy = n.bonusGranted ? Math.round(Number(n.bonusSavvy) || 0) : 0;
  return {
    triggered: Boolean(n.triggered),
    survivalMs: Math.round(Number(n.survivalMs) || 0),
    highestMultiplier: Math.round(Number(n.highestMultiplier) || 0),
    bonusScore: Math.round(Number(n.bonusScore) || 0),
    obstaclesEscaped: Math.round(Number(n.obstaclesEscaped) || 0),
    structuresDestroyed: Math.round(Number(n.structuresDestroyed) || 0),
    baseSavvy,
    bonusSavvy,
    totalSavvy: baseSavvy + bonusSavvy,
    rejected: Boolean(n.rejected),
  };
}

/** Records lifetime Nuke Flight proof-of-completion on the user document. */
function recordNukeFlightStats(user, { survivalMs, totalSurvivalMs, highestMultiplier, score, bonusSavvy }) {
  if (!user.scoutFlightStats) user.scoutFlightStats = {};
  const stats = user.scoutFlightStats;
  const now = new Date();

  stats.hasTriggeredScoutFlightNuke = true;
  stats.nukeFlightsTriggered = (Number(stats.nukeFlightsTriggered) || 0) + 1;
  stats.longestSurvivalMs = Math.max(Number(stats.longestSurvivalMs) || 0, totalSurvivalMs);
  stats.longestNukeSurvivalMs = Math.max(Number(stats.longestNukeSurvivalMs) || 0, survivalMs);
  stats.highestNukeMultiplier = Math.max(Number(stats.highestNukeMultiplier) || 0, highestMultiplier);
  stats.bestNukeScore = Math.max(Number(stats.bestNukeScore) || 0, score);
  stats.totalNukeBonusSavvy = (Number(stats.totalNukeBonusSavvy) || 0) + Math.max(0, bonusSavvy);
  if (!stats.firstNukeAt) stats.firstNukeAt = now;
  stats.lastNukeAt = now;
  user.markModified('scoutFlightStats');
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

async function submitTournamentScore(user, { runId, score, elapsedMs, baseScore, nuke }) {
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
      nuke: formatRunNukeResult(run),
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

  const validation = validateScoreSubmission(score, elapsedMs, run, baseScore);
  if (!validation.valid) {
    run.status = 'invalid';
    run.suspicious = true;
    run.suspiciousReason = validation.code;
    run.completedAt = new Date();
    await run.save();
    logScoutFlightValidation({
      runId: run.runId,
      userId: user._id,
      serverDurationMs: validation.elapsed,
      submittedScore: score,
      rejectionReason: validation.code,
      isTestRun: run.isTestRun,
      event: 'submit_rejected',
    });
    throw new ScoutFlightTournamentError(400, validation.code, validation.reason);
  }

  const evidenceEval = evaluateRunEvidence(run, validation.elapsed);
  const nukeClaimResult = validateNukeClaim(nuke, validation, run, evidenceEval);
  const nukeCheating = Boolean(nukeClaimResult.impossible);
  const strictReview = Boolean(nukeClaimResult.strictReview || evidenceEval.strictReview);

  const reconstructed = reconstructFinalScore(
    validation,
    nukeClaimResult,
    run,
    validation.claimedTotal ?? score
  );

  const withholdSavvy =
    run.isTestRun || validation.suspicious || nukeCheating || strictReview;

  const finalScore = reconstructed.finalScore;
  const savvyEarned = run.isTestRun ? 0 : resolveSavvyForScore(finalScore);
  const idempotencyKey = `scout_flight_tournament:${run.runId}`;

  run.score = finalScore;
  run.baseScore = reconstructed.serverBase;
  run.savvyEarned = savvyEarned;
  run.elapsedMs = validation.elapsed;
  run.suspicious = withholdSavvy;
  run.suspiciousReason = run.isTestRun
    ? 'TEST_RUN'
    : nukeCheating
      ? `NUKE_CLAIM_INVALID:${nukeClaimResult.rejectedReason}`
      : strictReview
        ? `STRICT_REVIEW:${nukeClaimResult.rejectedReason || 'EVIDENCE'}`
        : validation.suspiciousReason;
  run.completedAt = new Date();
  run.status = 'completed';
  run.submitIdempotencyKey = idempotencyKey;

  const nukeBonusSavvy =
    nukeClaimResult.triggered && !nukeClaimResult.rejected
      ? resolveNukeSavvyBonus(nukeClaimResult.survivalMs)
      : 0;

  run.nuke = {
    triggered: Boolean(nukeClaimResult.triggered),
    survivalMs: nukeClaimResult.survivalMs || 0,
    highestMultiplier: nukeClaimResult.highestMultiplier || 0,
    bonusScore: reconstructed.nukeBonus,
    obstaclesEscaped: nukeClaimResult.obstaclesEscaped || 0,
    structuresDestroyed: nukeClaimResult.structuresDestroyed || 0,
    bonusSavvy: withholdSavvy ? 0 : nukeBonusSavvy,
    bonusGranted: false,
    rejected: Boolean(nukeClaimResult.rejected),
    rejectedReason: nukeClaimResult.rejectedReason || null,
  };

  logScoutFlightValidation({
    runId: run.runId,
    userId: user._id,
    serverDurationMs: validation.elapsed,
    heartbeatCount: evidenceEval.heartbeatCount,
    obstacleCount: evidenceEval.obstacleCount,
    submittedScore: reconstructed.submitted,
    validatedScore: finalScore,
    rejectionReason: nukeClaimResult.rejectedReason,
    nukeEligible: nukeClaimResult.triggered && !nukeClaimResult.rejected,
    isTestRun: run.isTestRun,
    adjusted: reconstructed.adjusted,
    event: 'submit_validated',
  });

  let savvyGranted = false;
  let newBalance = Math.round(Number(user.savvyPoints) || 0);

  if (savvyEarned > 0 && !withholdSavvy) {
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

  // Nuke bonus is a separate, independently idempotent grant so it can be
  // audited (and reversed) without touching the base tournament payout.
  if (nukeClaimResult.triggered && !withholdSavvy && nukeBonusSavvy > 0 && !nukeClaimResult.rejected) {
    const nukeGrant = await grantSavvyReward(user, {
      rewardType: 'scout_flight_nuke',
      amount: nukeBonusSavvy,
      baseAmount: nukeBonusSavvy,
      idempotencyKey: `scout_flight_nuke:${run.runId}`,
      note: `Nuke Flight Streak — ${Math.floor(nukeClaimResult.survivalMs / 1000)}s at ${nukeClaimResult.highestMultiplier}X`,
      meta: {
        runId: run.runId,
        source: 'scout_flight_nuke',
        nukeSurvivalMs: nukeClaimResult.survivalMs,
        highestMultiplier: nukeClaimResult.highestMultiplier,
      },
    });
    run.nuke.bonusGranted = nukeGrant.granted || nukeGrant.duplicate;
    newBalance = nukeGrant.newBalance;
  }

  if (nukeClaimResult.triggered && !run.isTestRun && !withholdSavvy && !nukeClaimResult.rejected) {
    recordNukeFlightStats(user, {
      survivalMs: nukeClaimResult.survivalMs,
      totalSurvivalMs: validation.elapsed,
      highestMultiplier: nukeClaimResult.highestMultiplier,
      score: finalScore,
      bonusSavvy: run.nuke.bonusGranted ? nukeBonusSavvy : 0,
    });
  } else if (!run.isTestRun) {
    if (!user.scoutFlightStats) user.scoutFlightStats = {};
    user.scoutFlightStats.longestSurvivalMs = Math.max(
      Number(user.scoutFlightStats.longestSurvivalMs) || 0,
      validation.elapsed
    );
    user.markModified('scoutFlightStats');
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
    baseScore: validation.baseScore,
    savvyEarned,
    savvyGranted,
    savvyBalance: newBalance,
    suspicious: run.suspicious,
    nuke: formatRunNukeResult(run),
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

/**
 * Admin QA: read a user's Nuke Flight lifetime stats plus their recent Nuke runs.
 */
async function adminGetNukeStats(userId) {
  const stats = {
    hasTriggeredScoutFlightNuke: false,
    nukeFlightsTriggered: 0,
    longestSurvivalMs: 0,
    longestNukeSurvivalMs: 0,
    highestNukeMultiplier: 0,
    bestNukeScore: 0,
    totalNukeBonusSavvy: 0,
  };
  const User = require('../models/User');
  const target = await User.findById(userId).select('scoutFlightStats').lean();
  Object.assign(stats, target?.scoutFlightStats || {});

  const runs = await ScoutFlightRun.find({ userId, 'nuke.triggered': true })
    .sort({ completedAt: -1 })
    .limit(20)
    .select('runId score baseScore elapsedMs nuke completedAt suspicious')
    .lean();

  return { stats, runs, triggerMs: NUKE_TRIGGER_MS, maxMultiplier: MAX_NUKE_FLIGHT_MULTIPLIER };
}

/** Admin QA: clear a user's Nuke Flight stats so the discovery can be re-tested. */
async function adminResetNukeStats(user) {
  user.scoutFlightStats = {
    hasTriggeredScoutFlightNuke: false,
    nukeFlightsTriggered: 0,
    longestSurvivalMs: 0,
    longestNukeSurvivalMs: 0,
    highestNukeMultiplier: 0,
    bestNukeScore: 0,
    totalNukeBonusSavvy: 0,
    firstNukeAt: null,
    lastNukeAt: null,
    practiceNukeFlights: 0,
  };
  user.markModified('scoutFlightStats');
  await user.save();
  return { reset: true, stats: user.scoutFlightStats };
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
  adminGetNukeStats,
  adminResetNukeStats,
  expireStaleRuns,
  resolveSavvyForScore,
  validateScoreSubmission,
  validateNukeClaim,
  reconstructFinalScore,
  processRunHeartbeat,
  adminStartTestRun,
  formatRunNukeResult,
  recordNukeFlightStats,
};
