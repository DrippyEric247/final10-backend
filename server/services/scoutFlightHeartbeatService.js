/**
 * Scout Flight — server-validated gameplay heartbeats.
 *
 * Heartbeats accumulate lightweight evidence during eligible tournament runs.
 * The server receipt clock is authoritative; client timestamps are advisory only.
 */

const {
  HEARTBEAT_ELAPSED_JUMP_TOLERANCE_MS,
  HEARTBEAT_GRACE_SECONDS,
  HEARTBEAT_INTERVAL_SECONDS,
  MAX_SCORE_INCREASE_PER_HEARTBEAT,
  MAX_STACKED_RUN_MULTIPLIER,
  MIN_HEARTBEAT_COVERAGE_RATIO,
  NUKE_CLOCK_TOLERANCE_MS,
  NUKE_TRIGGER_MS,
  resolveMinHeartbeatsForDuration,
  resolveNukeMultiplier,
  resolveObstacleCountBounds,
} = require('../config/scoutFlightNukeConfig');
const { logScoutFlightValidation } = require('./scoutFlightValidationLog');

function defaultEvidence() {
  return {
    lastHeartbeatAt: null,
    lastSequence: -1,
    heartbeatCount: 0,
    maxObstaclesPassed: 0,
    maxScoreSeen: 0,
    maxBaseScoreSeen: 0,
    maxNukeMultiplierSeen: 1,
    maxRunMultiplierSeen: 1,
    largestGapMs: 0,
    gapCount: 0,
    rejectedHeartbeats: 0,
    lastScoreIncreaseAt: null,
  };
}

function ensureEvidence(run) {
  if (!run.evidence || typeof run.evidence !== 'object') {
    run.evidence = defaultEvidence();
  }
  return run.evidence;
}

function serverElapsedMs(run, at = Date.now()) {
  return Math.max(0, at - new Date(run.startTime).getTime());
}

/**
 * @param {import('../models/ScoutFlightRun')} run
 * @param {object} payload
 */
function validateHeartbeatPayload(run, payload) {
  const seq = Math.round(Number(payload.sequence));
  if (!Number.isFinite(seq) || seq < 0) {
    return { ok: false, code: 'INVALID_SEQUENCE' };
  }

  const evidence = ensureEvidence(run);

  if (seq <= evidence.lastSequence) {
    return { ok: false, code: 'SEQUENCE_REPLAY' };
  }

  const now = Date.now();
  const wallElapsed = serverElapsedMs(run, now);
  const clientElapsed = Math.max(0, Number(payload.elapsedRunTime) || 0);

  if (clientElapsed > wallElapsed + HEARTBEAT_ELAPSED_JUMP_TOLERANCE_MS) {
    return { ok: false, code: 'ELAPSED_JUMP' };
  }

  const obstacles = Math.max(0, Math.round(Number(payload.obstacleCountPassed) || 0));
  if (obstacles < evidence.maxObstaclesPassed) {
    return { ok: false, code: 'OBSTACLE_REGRESSION' };
  }

  const score = Math.max(0, Math.round(Number(payload.currentScore) || 0));
  const baseScore = Math.max(0, Math.round(Number(payload.baseScore) || score));
  const seqDelta = Math.max(1, seq - Math.max(0, evidence.lastSequence));
  const maxScoreJump = MAX_SCORE_INCREASE_PER_HEARTBEAT * seqDelta;

  if (score < evidence.maxScoreSeen) {
    return { ok: false, code: 'SCORE_REGRESSION' };
  }
  if (score - evidence.maxScoreSeen > maxScoreJump) {
    return { ok: false, code: 'SCORE_JUMP' };
  }
  if (baseScore > score) {
    return { ok: false, code: 'BASE_SCORE_INVALID' };
  }

  const runMult = Math.max(1, Math.min(MAX_STACKED_RUN_MULTIPLIER, Number(payload.runMultiplier) || 1));
  const nukeMult = Math.max(1, Number(payload.nukeMultiplier) || 1);
  const combined = Math.max(1, Number(payload.currentMultiplier) || runMult * nukeMult);
  if (combined > runMult * nukeMult + 0.01) {
    return { ok: false, code: 'MULTIPLIER_MISMATCH' };
  }

  if (payload.alive === false && run.status === 'active') {
    return { ok: false, code: 'ALIVE_FLAG_INVALID' };
  }

  return {
    ok: true,
    seq,
    wallElapsed,
    clientElapsed,
    obstacles,
    score,
    baseScore,
    runMult,
    nukeMult,
    combined,
    now,
  };
}

/**
 * Records one heartbeat on an active tournament run.
 * @returns {Promise<{ ok: boolean, code?: string, evidence?: object }>}
 */
async function recordHeartbeat(run, payload) {
  if (run.isTestRun) {
    // Test runs may heartbeat for UI QA but evidence never pays out.
  }

  if (run.status !== 'active') {
    return { ok: false, code: 'RUN_NOT_ACTIVE' };
  }

  if (new Date(run.expiresAt).getTime() < Date.now()) {
    return { ok: false, code: 'RUN_EXPIRED' };
  }

  const check = validateHeartbeatPayload(run, payload);
  if (!check.ok) {
    const evidence = ensureEvidence(run);
    evidence.rejectedHeartbeats += 1;
    run.markModified('evidence');
    await run.save();
    logScoutFlightValidation({
      runId: run.runId,
      userId: run.userId,
      event: 'heartbeat_rejected',
      rejectionReason: check.code,
      isTestRun: run.isTestRun,
    });
    return check;
  }

  const evidence = ensureEvidence(run);

  if (evidence.lastHeartbeatAt) {
    const gapMs = check.now - new Date(evidence.lastHeartbeatAt).getTime();
    const expectedGap = HEARTBEAT_INTERVAL_SECONDS * 1000;
    if (gapMs > expectedGap + HEARTBEAT_GRACE_SECONDS * 1000) {
      evidence.gapCount += 1;
      evidence.largestGapMs = Math.max(evidence.largestGapMs, gapMs);
    }
  }

  if (check.score > evidence.maxScoreSeen) {
    evidence.lastScoreIncreaseAt = new Date(check.now);
  }

  evidence.lastSequence = check.seq;
  evidence.heartbeatCount += 1;
  evidence.lastHeartbeatAt = new Date(check.now);
  evidence.maxObstaclesPassed = Math.max(evidence.maxObstaclesPassed, check.obstacles);
  evidence.maxScoreSeen = Math.max(evidence.maxScoreSeen, check.score);
  evidence.maxBaseScoreSeen = Math.max(evidence.maxBaseScoreSeen, check.baseScore);
  evidence.maxRunMultiplierSeen = Math.max(evidence.maxRunMultiplierSeen, check.runMult);
  evidence.maxNukeMultiplierSeen = Math.max(evidence.maxNukeMultiplierSeen, check.nukeMult);

  run.markModified('evidence');
  await run.save();

  return { ok: true, evidence: { ...evidence } };
}

/**
 * Evaluates cumulative heartbeat evidence at run end.
 * @param {object} run
 * @param {number} elapsedMs validated server-side elapsed duration
 */
function evaluateRunEvidence(run, elapsedMs) {
  const evidence = run?.evidence || defaultEvidence();
  const issues = [];
  const ms = Math.max(0, Number(elapsedMs) || 0);
  const longRun = ms >= NUKE_TRIGGER_MS;

  if (longRun) {
    const minHeartbeats = resolveMinHeartbeatsForDuration(ms);
    if (evidence.heartbeatCount < minHeartbeats) {
      issues.push({
        code: 'INSUFFICIENT_HEARTBEATS',
        strict: true,
        impossible: false,
      });
    }

    if (evidence.lastHeartbeatAt) {
      const endGap = Date.now() - new Date(evidence.lastHeartbeatAt).getTime();
      if (endGap > HEARTBEAT_GRACE_SECONDS * 1000) {
        issues.push({
          code: 'HEARTBEAT_GAP_AT_END',
          strict: true,
          impossible: false,
        });
      }
    } else {
      issues.push({
        code: 'NO_HEARTBEATS',
        strict: true,
        impossible: true,
      });
    }
  }

  const bounds = resolveObstacleCountBounds(ms);
  const obstacleCount = evidence.maxObstaclesPassed;

  if (longRun && obstacleCount < bounds.min) {
    issues.push({
      code: 'OBSTACLE_EVIDENCE_LOW',
      strict: false,
      impossible: true,
    });
  } else if (obstacleCount > bounds.max) {
    issues.push({
      code: 'OBSTACLE_EVIDENCE_HIGH',
      strict: false,
      impossible: true,
    });
  }

  if (longRun && evidence.maxScoreSeen <= 0 && ms > NUKE_TRIGGER_MS) {
    issues.push({
      code: 'IDLE_SCORE',
      strict: false,
      impossible: true,
    });
  }

  const impossible = issues.some((i) => i.impossible);
  const strictReview = issues.some((i) => i.strict);

  return {
    evidence,
    bounds,
    issues,
    impossible,
    strictReview,
    obstacleCount,
    heartbeatCount: evidence.heartbeatCount,
  };
}

/**
 * Server-derived Nuke survival and multiplier from validated elapsed time + claim.
 */
function deriveNukeSurvivalMs(validation, claim) {
  const serverElapsed = validation.elapsed;
  if (serverElapsed + NUKE_CLOCK_TOLERANCE_MS < NUKE_TRIGGER_MS) return 0;

  const claimed = Math.max(0, Math.round(Number(claim?.nukeSurvivalMs) || 0));
  const maxAllowed = Math.max(0, serverElapsed - NUKE_TRIGGER_MS) + NUKE_CLOCK_TOLERANCE_MS;
  return Math.min(claimed, maxAllowed);
}

function deriveServerNukeMultiplier(nukeSurvivalMs) {
  return resolveNukeMultiplier(nukeSurvivalMs);
}

module.exports = {
  defaultEvidence,
  ensureEvidence,
  serverElapsedMs,
  validateHeartbeatPayload,
  recordHeartbeat,
  evaluateRunEvidence,
  deriveNukeSurvivalMs,
  deriveServerNukeMultiplier,
};
