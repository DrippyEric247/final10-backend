const {
  computeHeartbeatCredit,
  buildCheckpointProgress,
} = require('../services/savvyWatchPresenceService');
const { DEFAULT_CHECKPOINTS } = require('../config/savvyWatchConfig');

describe('savvyWatch presence verification', () => {
  test('credits visible heartbeat intervals up to max window', () => {
    const session = {
      status: 'active',
      lastHeartbeatAt: new Date('2026-01-01T00:00:00Z'),
      backgroundSince: null,
    };
    const now = new Date('2026-01-01T00:00:50Z');
    const result = computeHeartbeatCredit(session, { visible: true, now });
    expect(result.creditSeconds).toBe(50);
    expect(result.status).toBe('active');
  });

  test('pauses credit after sustained background', () => {
    const session = {
      status: 'active',
      lastHeartbeatAt: new Date('2026-01-01T00:00:00Z'),
      backgroundSince: new Date('2026-01-01T00:00:00Z'),
    };
    const now = new Date('2026-01-01T00:02:00Z');
    const result = computeHeartbeatCredit(session, { visible: false, now });
    expect(result.creditSeconds).toBe(0);
  });

  test('brief background reduces credit instead of zeroing', () => {
    const session = {
      status: 'active',
      lastHeartbeatAt: new Date('2026-01-01T00:00:00Z'),
      backgroundSince: new Date('2026-01-01T00:00:30Z'),
    };
    const now = new Date('2026-01-01T00:01:00Z');
    const result = computeHeartbeatCredit(session, { visible: false, now });
    expect(result.creditSeconds).toBeGreaterThan(0);
    expect(result.creditSeconds).toBeLessThan(45);
  });

  test('buildCheckpointProgress marks presence eligibility from verified seconds', () => {
    const event = { status: 'live', rewardRules: { checkpoints: DEFAULT_CHECKPOINTS } };
    const session = { verifiedActiveSeconds: 2000, checkpointClaims: ['join'] };
    const progress = buildCheckpointProgress(event, session);
    const min15 = progress.find((c) => c.id === '15min');
    const min30 = progress.find((c) => c.id === '30min');
    expect(min15.eligible).toBe(true);
    expect(min15.claimed).toBe(false);
    expect(min30.eligible).toBe(true);
    const complete = progress.find((c) => c.id === 'complete');
    expect(complete.eligible).toBe(false);
  });

  test('completion checkpoint eligible only when event ended', () => {
    const event = { status: 'ended', rewardRules: { checkpoints: DEFAULT_CHECKPOINTS } };
    const session = { verifiedActiveSeconds: 0, checkpointClaims: [] };
    const progress = buildCheckpointProgress(event, session);
    expect(progress.find((c) => c.id === 'complete').eligible).toBe(true);
  });
});
