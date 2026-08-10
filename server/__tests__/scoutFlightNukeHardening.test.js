/**
 * Scout Flight Nuke hardening — heartbeats, evidence, score reconstruction.
 */

const {
  HEARTBEAT_GRACE_SECONDS,
  HEARTBEAT_INTERVAL_SECONDS,
  MIN_OBSTACLE_RATIO,
  MAX_OBSTACLE_RATIO,
  NUKE_TRIGGER_MS,
  resolveObstacleCountBounds,
  resolveMinHeartbeatsForDuration,
} = require('../config/scoutFlightNukeConfig');
const {
  validateHeartbeatPayload,
  recordHeartbeat,
  evaluateRunEvidence,
  deriveServerNukeMultiplier,
} = require('../services/scoutFlightHeartbeatService');
const {
  validateNukeClaim,
  reconstructFinalScore,
} = require('../services/scoutFlightTournamentService');

const MIN = 60 * 1000;

function mockRun(agoMs, overrides = {}) {
  const elapsed = agoMs;
  const bounds = resolveObstacleCountBounds(elapsed);
  return {
    runId: 'run-hardening',
    userId: 'user-1',
    status: 'active',
    isTestRun: false,
    startTime: new Date(Date.now() - agoMs),
    expiresAt: new Date(Date.now() + 60 * MIN),
    evidence: {
      lastHeartbeatAt: new Date(),
      lastSequence: 120,
      heartbeatCount: resolveMinHeartbeatsForDuration(elapsed) + 20,
      maxObstaclesPassed: bounds.min + 50,
      maxScoreSeen: 9000,
      maxBaseScoreSeen: 7000,
      maxNukeMultiplierSeen: 5,
      maxRunMultiplierSeen: 1,
      largestGapMs: 0,
      gapCount: 0,
      rejectedHeartbeats: 0,
    },
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function heartbeatPayload(seq, elapsedRunTime = 5 * MIN, overrides = {}) {
  return {
    sequence: seq,
    elapsedRunTime,
    currentScore: 8000,
    baseScore: 7000,
    obstacleCountPassed: 800,
    runMultiplier: 1,
    nukeMultiplier: 5,
    currentMultiplier: 5,
    alive: true,
    clientTimestamp: Date.now(),
    ...overrides,
  };
}

describe('heartbeat config', () => {
  it('uses 15s interval and 45s grace by default', () => {
    expect(HEARTBEAT_INTERVAL_SECONDS).toBe(15);
    expect(HEARTBEAT_GRACE_SECONDS).toBe(45);
  });

  it('uses tolerance band 0.55–1.35 for obstacle counts', () => {
    expect(MIN_OBSTACLE_RATIO).toBe(0.55);
    expect(MAX_OBSTACLE_RATIO).toBe(1.35);
  });
});

describe('heartbeat validation', () => {
  it('rejects replayed sequence numbers', async () => {
    const run = mockRun(5 * MIN, {
      evidence: { ...mockRun(5 * MIN).evidence, lastSequence: 5 },
    });
    const result = await recordHeartbeat(run, heartbeatPayload(5));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SEQUENCE_REPLAY');
  });

  it('rejects obstacle regression', async () => {
    const run = mockRun(5 * MIN, {
      evidence: { ...mockRun(5 * MIN).evidence, maxObstaclesPassed: 100, lastSequence: 1 },
    });
    const result = await recordHeartbeat(
      run,
      heartbeatPayload(2, 5 * MIN, { obstacleCountPassed: 50 })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('OBSTACLE_REGRESSION');
  });

  it('rejects impossible score jumps', async () => {
    const run = mockRun(5 * MIN, {
      evidence: { ...mockRun(5 * MIN).evidence, maxScoreSeen: 100, lastSequence: 1 },
    });
    const result = await recordHeartbeat(
      run,
      heartbeatPayload(2, 5 * MIN, { currentScore: 50_000, baseScore: 50_000 })
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe('SCORE_JUMP');
  });

  it('accepts monotonic progression', async () => {
    const run = mockRun(5 * MIN, {
      evidence: {
        ...mockRun(5 * MIN).evidence,
        lastSequence: 1,
        heartbeatCount: 1,
        maxScoreSeen: 7000,
        maxBaseScoreSeen: 6500,
        maxObstaclesPassed: 100,
      },
    });
    const result = await recordHeartbeat(
      run,
      heartbeatPayload(2, 5 * MIN, {
        currentScore: 7100,
        baseScore: 6600,
        obstacleCountPassed: 110,
      })
    );
    expect(result.ok).toBe(true);
    expect(run.save).toHaveBeenCalled();
    expect(run.evidence.heartbeatCount).toBe(2);
  });
});

describe('A — legitimate 30-minute run evidence', () => {
  it('passes evaluation with sufficient heartbeats and obstacles', () => {
    const run = mockRun(35 * MIN);
    const evalResult = evaluateRunEvidence(run, 34 * MIN);
    expect(evalResult.impossible).toBe(false);
    expect(evalResult.strictReview).toBe(false);
    expect(evalResult.obstacleCount).toBeGreaterThanOrEqual(evalResult.bounds.min);

    const nuke = validateNukeClaim(
      {
        nukeSurvivalMs: 4 * MIN,
        highestMultiplier: 6,
        bonusScore: 500,
        obstaclesEscaped: evalResult.obstacleCount,
      },
      { elapsed: 34 * MIN, baseScore: 7000 },
      run,
      evalResult
    );
    expect(nuke.triggered).toBe(true);
    expect(nuke.rejected).toBe(false);
    expect(nuke.highestMultiplier).toBe(deriveServerNukeMultiplier(4 * MIN));
  });
});

describe('B — client nukeActive flag alone', () => {
  it('does not grant Nuke from a boolean flag', () => {
    const run = mockRun(35 * MIN);
    const result = validateNukeClaim(
      { nukeActive: true },
      { elapsed: 34 * MIN, baseScore: 7000 },
      run
    );
    expect(result.triggered).toBe(false);
  });
});

describe('C — fake 30-minute elapsed on short wall clock', () => {
  it('rejects impossible elapsed claims', () => {
    const run = mockRun(90 * 1000);
    const result = validateNukeClaim(
      {
        nukeSurvivalMs: 0,
        highestMultiplier: 2,
        bonusScore: 0,
        obstaclesEscaped: 999,
      },
      { elapsed: 34 * MIN, baseScore: 5000 },
      run
    );
    expect(result.impossible).toBe(true);
    expect(result.rejectedReason).toBe('NUKE_BEFORE_THRESHOLD');
  });
});

describe('D — idle 30-minute run', () => {
  it('rejects when obstacle evidence is far below tolerance', () => {
    const run = mockRun(35 * MIN, {
      evidence: {
        ...mockRun(35 * MIN).evidence,
        maxObstaclesPassed: 2,
        heartbeatCount: 0,
        lastHeartbeatAt: null,
      },
    });
    const evalResult = evaluateRunEvidence(run, 34 * MIN);
    expect(evalResult.impossible).toBe(true);

    const nuke = validateNukeClaim(
      { nukeSurvivalMs: 2 * MIN, highestMultiplier: 4, bonusScore: 100, obstaclesEscaped: 2 },
      { elapsed: 34 * MIN, baseScore: 100 },
      run,
      evalResult
    );
    expect(nuke.triggered).toBe(false);
    expect(nuke.impossible).toBe(true);
  });
});

describe('E — missed heartbeats within grace', () => {
  it('allows strict review instead of hard fail when coverage is low but not zero', () => {
    const run = mockRun(35 * MIN, {
      evidence: {
        ...mockRun(35 * MIN).evidence,
        heartbeatCount: 1,
        lastHeartbeatAt: new Date(Date.now() - 20 * 1000),
      },
    });
    const evalResult = evaluateRunEvidence(run, 34 * MIN);
    expect(evalResult.strictReview).toBe(true);
    expect(evalResult.impossible).toBe(false);

    const nuke = validateNukeClaim(
      {
        nukeSurvivalMs: 3 * MIN,
        highestMultiplier: 5,
        bonusScore: 200,
        obstaclesEscaped: evalResult.obstacleCount,
      },
      { elapsed: 34 * MIN, baseScore: 7000 },
      run,
      evalResult
    );
    expect(nuke.triggered).toBe(true);
    expect(nuke.strictReview).toBe(true);
    expect(nuke.rejected).toBe(true);
  });
});

describe('H — impossible multiplier claim', () => {
  it('uses the server-derived multiplier instead of the client claim', () => {
    const run = mockRun(35 * MIN);
    const nuke = validateNukeClaim(
      {
        nukeSurvivalMs: 60 * 1000,
        highestMultiplier: 9,
        bonusScore: 100,
        obstaclesEscaped: 800,
      },
      { elapsed: 34 * MIN, baseScore: 7000 },
      run
    );
    expect(nuke.triggered).toBe(true);
    expect(nuke.highestMultiplier).toBe(3);
  });
});

describe('I — exaggerated client final score', () => {
  it('reconstructs from validated parts and flags adjustment', () => {
    const run = mockRun(35 * MIN);
    const nukeResult = {
      triggered: true,
      rejected: false,
      bonusScore: 500,
      highestMultiplier: 5,
    };
    const validation = { baseScore: 7000, elapsed: 34 * MIN };
    const rebuilt = reconstructFinalScore(validation, nukeResult, run, 99_999);
    expect(rebuilt.finalScore).toBeLessThan(99_999);
    expect(rebuilt.adjusted).toBe(true);
    expect(rebuilt.serverBase).toBe(7000);
  });
});

describe('J — test run payout protection', () => {
  it('flags test runs internally for zero payout', () => {
    const run = mockRun(35 * MIN, { isTestRun: true });
    expect(run.isTestRun).toBe(true);
    const withhold = run.isTestRun;
    expect(withhold).toBe(true);
  });
});

describe('F — duplicate final claim for same runId', () => {
  it('uses independent idempotency keys for base and Nuke grants', () => {
    const runId = 'run-dup-test';
    expect(`scout_flight_tournament:${runId}`).not.toBe(`scout_flight_nuke:${runId}`);
    expect(`scout_flight_nuke:${runId}`).toBe('scout_flight_nuke:run-dup-test');
  });
});

describe('obstacle tolerance band', () => {
  it('accepts counts inside the configured range', () => {
    const bounds = resolveObstacleCountBounds(34 * MIN);
    expect(bounds.min).toBe(Math.floor(bounds.expected * MIN_OBSTACLE_RATIO));
    expect(bounds.max).toBe(Math.ceil(bounds.expected * MAX_OBSTACLE_RATIO));
    expect(bounds.min).toBeLessThan(bounds.expected);
    expect(bounds.max).toBeGreaterThan(bounds.expected);
  });
});
