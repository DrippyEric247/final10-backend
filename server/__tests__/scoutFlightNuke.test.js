/**
 * Nuke Flight Streak — server authority tests.
 *
 * These cover the pure validation/economy layer, which is where every payout
 * decision is made. No database is required.
 */

const {
  MAX_NUKE_FLIGHT_MULTIPLIER,
  MAX_NUKE_SAVVY_BONUS,
  NUKE_ACTIVATION_SAVVY,
  NUKE_CLOCK_TOLERANCE_MS,
  NUKE_ELIGIBLE_REWARD_TYPES,
  NUKE_EXCLUDED_REWARD_TYPES,
  NUKE_MULTIPLIER_START,
  NUKE_SAVVY_PER_MINUTE,
  NUKE_TRIGGER_MS,
  isNukeEligibleRewardType,
  resolveMinObstaclesEscaped,
  resolveObstacleCountBounds,
  resolveMaxNukeBonusScore,
  resolveNukeMultiplier,
  resolveNukeSavvyBonus,
} = require('../config/scoutFlightNukeConfig');
const {
  RUN_TIMEOUT_MS,
  MAX_SCORE,
  MAX_SCORE_ABSOLUTE,
  resolveMaxScoreForElapsed,
} = require('../config/scoutFlightTournamentConfig');
const {
  validateScoreSubmission,
  validateNukeClaim,
  formatRunNukeResult,
  recordNukeFlightStats,
} = require('../services/scoutFlightTournamentService');

const MIN = 60 * 1000;

/** A run that started `agoMs` ago, as the server sees it. */
function runStartedAgo(agoMs) {
  return { runId: 'run-1', startTime: new Date(Date.now() - agoMs) };
}

/** Run with server-side heartbeat evidence for long-run validation tests. */
function runWithEvidence(agoMs, evidenceOverrides = {}) {
  const bounds = resolveObstacleCountBounds(agoMs);
  return {
    runId: 'run-1',
    startTime: new Date(Date.now() - agoMs),
    isTestRun: false,
    evidence: {
      lastHeartbeatAt: new Date(),
      lastSequence: 120,
      heartbeatCount: 100,
      maxObstaclesPassed: bounds.min + 50,
      maxScoreSeen: 9000,
      maxBaseScoreSeen: 7000,
      maxNukeMultiplierSeen: 5,
      maxRunMultiplierSeen: 1,
      ...evidenceOverrides,
    },
  };
}

function nukeClaim(overrides = {}) {
  return {
    nukeSurvivalMs: 3 * MIN,
    highestMultiplier: 5,
    bonusScore: 500,
    obstaclesEscaped: 700,
    structuresDestroyed: 690,
    ...overrides,
  };
}

describe('nuke config', () => {
  it('triggers at 30 minutes', () => {
    expect(NUKE_TRIGGER_MS).toBe(30 * MIN);
  });

  it('escalates one multiplier step per minute up to the configured cap', () => {
    expect(resolveNukeMultiplier(0)).toBe(NUKE_MULTIPLIER_START);
    expect(resolveNukeMultiplier(60_000)).toBe(3);
    expect(resolveNukeMultiplier(180_000)).toBe(5);
    expect(resolveNukeMultiplier(24 * 60 * MIN)).toBe(MAX_NUKE_FLIGHT_MULTIPLIER);
  });

  it('keeps the multiplier capped so the Savvy economy cannot be broken', () => {
    expect(MAX_NUKE_FLIGHT_MULTIPLIER).toBeLessThanOrEqual(20);
    expect(resolveNukeMultiplier(Number.MAX_SAFE_INTEGER)).toBe(MAX_NUKE_FLIGHT_MULTIPLIER);
  });

  it('pays an activation bonus plus a per-minute rate, hard-capped', () => {
    expect(resolveNukeSavvyBonus(0)).toBe(NUKE_ACTIVATION_SAVVY);
    expect(resolveNukeSavvyBonus(2 * MIN)).toBe(NUKE_ACTIVATION_SAVVY + 2 * NUKE_SAVVY_PER_MINUTE);
    expect(resolveNukeSavvyBonus(10_000 * MIN)).toBe(MAX_NUKE_SAVVY_BONUS);
  });

  it('allowlists only numeric gameplay rewards', () => {
    expect(NUKE_ELIGIBLE_REWARD_TYPES).toEqual(['coin_value', 'score', 'savvy']);
    for (const type of NUKE_ELIGIBLE_REWARD_TYPES) {
      expect(isNukeEligibleRewardType(type)).toBe(true);
    }
  });

  it('refuses to multiply tickets, cosmetics, eggs, and one-time unlocks', () => {
    for (const type of NUKE_EXCLUDED_REWARD_TYPES) {
      expect(isNukeEligibleRewardType(type)).toBe(false);
    }
    expect(isNukeEligibleRewardType('scout_flight_ticket')).toBe(false);
    expect(isNukeEligibleRewardType(undefined)).toBe(false);
  });
});

describe('run window and score ceiling', () => {
  it('allows a run long enough to reach and survive the Nuke', () => {
    expect(RUN_TIMEOUT_MS).toBeGreaterThan(NUKE_TRIGGER_MS);
    expect(RUN_TIMEOUT_MS).toBeGreaterThanOrEqual(40 * MIN);
  });

  it('keeps the original ceiling for short runs', () => {
    expect(resolveMaxScoreForElapsed(0)).toBe(MAX_SCORE);
    expect(resolveMaxScoreForElapsed(60_000)).toBe(MAX_SCORE);
  });

  it('scales the ceiling so a legitimate 35-minute run is not rejected', () => {
    // A flat 10,000 cap would have failed a real long flight.
    expect(resolveMaxScoreForElapsed(35 * MIN)).toBeGreaterThan(MAX_SCORE);
    expect(resolveMaxScoreForElapsed(35 * MIN)).toBe(35 * 60 * 18);
  });

  it('never exceeds the absolute ceiling', () => {
    expect(resolveMaxScoreForElapsed(100 * 60 * MIN)).toBe(MAX_SCORE_ABSOLUTE);
  });
});

describe('validateScoreSubmission', () => {
  it('accepts an ordinary run', () => {
    const result = validateScoreSubmission(120, 30_000, runStartedAgo(31_000));
    expect(result.valid).toBe(true);
    expect(result.suspicious).toBe(false);
    expect(result.baseScore).toBe(120);
  });

  it('caps client elapsed time at the server wall clock', () => {
    const result = validateScoreSubmission(100, 60 * MIN, runStartedAgo(20_000));
    expect(result.valid).toBe(true);
    expect(result.elapsed).toBeLessThanOrEqual(21_000);
  });

  it('rejects a high score in an impossibly short run', () => {
    const result = validateScoreSubmission(5000, 2000, runStartedAgo(2500));
    expect(result.valid).toBe(false);
    expect(result.code).toBe('RUN_TOO_SHORT');
  });

  it('rejects a score above the duration-aware ceiling', () => {
    const result = validateScoreSubmission(999_999, 40 * MIN, runStartedAgo(41 * MIN));
    expect(result.valid).toBe(false);
    expect(result.code).toBe('SCORE_OUT_OF_RANGE');
  });

  it('accepts a large score that a 35-minute flight can genuinely produce', () => {
    const result = validateScoreSubmission(11_000, 35 * MIN, runStartedAgo(36 * MIN));
    expect(result.valid).toBe(true);
    expect(result.suspicious).toBe(false);
  });

  it('rate-limits the base score, not the Nuke-inflated total', () => {
    // 6,000 base over 35 minutes is calm; the 40,000 total is Nuke bonus.
    const result = validateScoreSubmission(40_000, 35 * MIN, runStartedAgo(36 * MIN), 6_000);
    expect(result.valid).toBe(true);
    expect(result.suspicious).toBe(false);
    expect(result.baseScore).toBe(6_000);
    // The total is only ever a claim; the recorded score is rebuilt from parts.
    expect(result.claimedTotal).toBe(40_000);
  });

  it('rejects an inflated base score even when the total looks plausible', () => {
    const result = validateScoreSubmission(50_000, 35 * MIN, runStartedAgo(36 * MIN), 50_000);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('SCORE_OUT_OF_RANGE');
  });

  it('still flags an implausible base score rate', () => {
    const result = validateScoreSubmission(9_000, 60_000, runStartedAgo(61_000), 9_000);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('SCORE_IMPLAUSIBLE');
  });

  it('never lets a claimed base score exceed the total', () => {
    const result = validateScoreSubmission(100, 30_000, runStartedAgo(31_000), 99_999);
    expect(result.baseScore).toBe(100);
  });
});

describe('validateNukeClaim', () => {
  const longRun = () => runWithEvidence(35 * MIN);
  const longValidation = () => ({ elapsed: 34 * MIN, baseScore: 6_000 });

  it('reports no Nuke when nothing is claimed', () => {
    expect(validateNukeClaim(null, longValidation(), longRun())).toEqual({ triggered: false });
    expect(validateNukeClaim(undefined, longValidation(), longRun()).triggered).toBe(false);
  });

  it('accepts a consistent claim', () => {
    const result = validateNukeClaim(nukeClaim(), longValidation(), longRun());
    expect(result.triggered).toBe(true);
    expect(result.rejected).toBe(false);
    expect(result.highestMultiplier).toBe(5);
    expect(result.survivalMs).toBe(3 * MIN);
  });

  it('treats a Nuke claimed inside a short wall-clock run as cheating', () => {
    const result = validateNukeClaim(
      nukeClaim(),
      { elapsed: 34 * MIN, baseScore: 6_000 },
      runStartedAgo(90_000)
    );
    expect(result.triggered).toBe(false);
    expect(result.impossible).toBe(true);
    expect(result.rejectedReason).toBe('NUKE_BEFORE_THRESHOLD');
  });

  it('rejects a claim whose active time never reached the threshold', () => {
    const result = validateNukeClaim(
      nukeClaim(),
      { elapsed: 5 * MIN, baseScore: 500 },
      longRun()
    );
    expect(result.impossible).toBe(true);
    expect(result.rejectedReason).toBe('NUKE_ACTIVE_TIME_TOO_SHORT');
  });

  it('caps Nuke survival to the server-derived maximum instead of trusting inflated claims', () => {
    const result = validateNukeClaim(
      nukeClaim({ nukeSurvivalMs: 30 * MIN }),
      longValidation(),
      longRun()
    );
    expect(result.triggered).toBe(true);
    expect(result.survivalMs).toBeLessThan(30 * MIN);
    expect(result.survivalMs).toBeLessThanOrEqual(4 * MIN + NUKE_CLOCK_TOLERANCE_MS);
  });

  it('uses the server multiplier when the client overclaims', () => {
    const result = validateNukeClaim(
      nukeClaim({ nukeSurvivalMs: 30_000, highestMultiplier: 9 }),
      longValidation(),
      longRun()
    );
    expect(result.triggered).toBe(true);
    expect(result.highestMultiplier).toBe(resolveNukeMultiplier(30_000));
    expect(result.multiplierAdjusted).toBe(true);
  });

  it('caps an inflated multiplier claim to the server-derived value', () => {
    const result = validateNukeClaim(
      nukeClaim({ nukeSurvivalMs: 3 * MIN, highestMultiplier: 999 }),
      longValidation(),
      longRun()
    );
    expect(result.triggered).toBe(true);
    expect(result.highestMultiplier).toBe(resolveNukeMultiplier(3 * MIN));
    expect(result.multiplierAdjusted).toBe(true);
  });

  it('caps an excessive bonus score instead of trusting the client total', () => {
    const result = validateNukeClaim(
      nukeClaim({ bonusScore: 5_000_000 }),
      longValidation(),
      longRun()
    );
    expect(result.triggered).toBe(true);
    expect(result.bonusScore).toBeLessThan(5_000_000);
  });

  it('allows a bonus consistent with a stacked 2x pickup', () => {
    const validation = { elapsed: 34 * MIN, baseScore: 1_000 };
    const run = runWithEvidence(35 * MIN, {
      maxBaseScoreSeen: 1_000,
      maxObstaclesPassed: resolveObstacleCountBounds(34 * MIN).min + 10,
    });
    expect(resolveMaxNukeBonusScore(1_000, 5)).toBe(9_000);
    const ok = validateNukeClaim(nukeClaim({ bonusScore: 9_000 }), validation, run);
    expect(ok.triggered).toBe(true);

    const tooMuch = validateNukeClaim(nukeClaim({ bonusScore: 9_001 }), validation, run);
    expect(tooMuch.bonusScore).toBeLessThanOrEqual(9_000);
  });

  it('rejects negative survival via capped derivation', () => {
    const result = validateNukeClaim(
      nukeClaim({ nukeSurvivalMs: -1 }),
      longValidation(),
      longRun()
    );
    expect(result.triggered).toBe(true);
    expect(result.survivalMs).toBeGreaterThanOrEqual(0);
  });

  it('ignores a bare client boolean — eligibility comes from run state', () => {
    const result = validateNukeClaim({ nukeActive: true }, longValidation(), longRun());
    expect(result.triggered).toBe(false);
  });

  it('sanitises junk counter values instead of trusting them', () => {
    const result = validateNukeClaim(
      nukeClaim({ structuresDestroyed: 'lots' }),
      longValidation(),
      longRun()
    );
    expect(result.triggered).toBe(true);
    expect(result.structuresDestroyed).toBe(0);
  });

  it('requires gameplay evidence, not just a long clock', () => {
    const idleRun = runWithEvidence(35 * MIN, {
      maxObstaclesPassed: 0,
      heartbeatCount: 0,
      lastHeartbeatAt: null,
    });
    const idle = validateNukeClaim(
      nukeClaim({ obstaclesEscaped: 0 }),
      longValidation(),
      idleRun
    );
    expect(idle.triggered).toBe(false);
    expect(idle.impossible).toBe(true);

    const negative = validateNukeClaim(
      nukeClaim({ obstaclesEscaped: -50 }),
      longValidation(),
      idleRun
    );
    expect(negative.triggered).toBe(false);
  });

  it('uses tolerance band for obstacle counts', () => {
    const bounds = resolveObstacleCountBounds(34 * MIN);
    const lowEvidenceRun = runWithEvidence(35 * MIN, {
      maxObstaclesPassed: bounds.min - 1,
    });
    const justUnder = validateNukeClaim(nukeClaim(), longValidation(), lowEvidenceRun);
    expect(justUnder.triggered).toBe(false);

    const goodRun = runWithEvidence(35 * MIN, {
      maxObstaclesPassed: bounds.min,
    });
    const justOver = validateNukeClaim(nukeClaim(), longValidation(), goodRun);
    expect(justOver.triggered).toBe(true);
  });

  it('absorbs small clock drift within tolerance', () => {
    const validation = { elapsed: NUKE_TRIGGER_MS - 5_000, baseScore: 5_000 };
    const result = validateNukeClaim(
      nukeClaim({ nukeSurvivalMs: 0, highestMultiplier: 2, bonusScore: 0 }),
      validation,
      runWithEvidence(NUKE_TRIGGER_MS + 1_000, {
        maxObstaclesPassed: resolveObstacleCountBounds(NUKE_TRIGGER_MS).min,
        heartbeatCount: 80,
      })
    );
    expect(result.triggered).toBe(true);
    expect(NUKE_CLOCK_TOLERANCE_MS).toBeGreaterThan(0);
  });
});

describe('formatRunNukeResult', () => {
  it('returns nothing for a run that never reached the Nuke', () => {
    expect(formatRunNukeResult({ nuke: { triggered: false, rejected: false } })).toBeNull();
    expect(formatRunNukeResult({})).toBeNull();
  });

  it('reports only granted Savvy and hides the internal rejection reason', () => {
    const payload = formatRunNukeResult({
      savvyGranted: true,
      savvyEarned: 300,
      nuke: {
        triggered: true,
        survivalMs: 3 * MIN,
        highestMultiplier: 5,
        bonusScore: 900,
        obstaclesEscaped: 700,
        structuresDestroyed: 690,
        bonusSavvy: 800,
        bonusGranted: true,
        rejected: false,
        rejectedReason: 'SOMETHING_INTERNAL',
      },
    });
    expect(payload.baseSavvy).toBe(300);
    expect(payload.bonusSavvy).toBe(800);
    expect(payload.totalSavvy).toBe(1100);
    expect(payload.rejectedReason).toBeUndefined();
  });

  it('reports zero bonus when the grant was withheld', () => {
    const payload = formatRunNukeResult({
      savvyGranted: false,
      savvyEarned: 300,
      nuke: { triggered: true, bonusSavvy: 800, bonusGranted: false, rejected: true },
    });
    expect(payload.baseSavvy).toBe(0);
    expect(payload.bonusSavvy).toBe(0);
    expect(payload.totalSavvy).toBe(0);
    expect(payload.rejected).toBe(true);
  });
});

describe('recordNukeFlightStats', () => {
  it('persists proof of completion and keeps records monotonic', () => {
    const user = { scoutFlightStats: {}, markModified: jest.fn() };
    recordNukeFlightStats(user, {
      survivalMs: 4 * MIN,
      totalSurvivalMs: 34 * MIN,
      highestMultiplier: 6,
      score: 12_000,
      bonusSavvy: 900,
    });

    const s = user.scoutFlightStats;
    expect(s.hasTriggeredScoutFlightNuke).toBe(true);
    expect(s.nukeFlightsTriggered).toBe(1);
    expect(s.longestNukeSurvivalMs).toBe(4 * MIN);
    expect(s.highestNukeMultiplier).toBe(6);
    expect(s.firstNukeAt).toBeInstanceOf(Date);

    recordNukeFlightStats(user, {
      survivalMs: 1 * MIN,
      totalSurvivalMs: 31 * MIN,
      highestMultiplier: 3,
      score: 8_000,
      bonusSavvy: 600,
    });

    expect(s.nukeFlightsTriggered).toBe(2);
    // A worse run must never lower a personal record.
    expect(s.longestNukeSurvivalMs).toBe(4 * MIN);
    expect(s.highestNukeMultiplier).toBe(6);
    expect(s.bestNukeScore).toBe(12_000);
    expect(s.totalNukeBonusSavvy).toBe(1500);
  });
});
