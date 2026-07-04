/**
 * Live event activation queue + seen state tests.
 */

jest.mock('../services/supplyDropService', () => ({
  getActiveDropForUser: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/savvySaleService', () => ({
  getActiveSavvySale: jest.fn().mockResolvedValue(null),
}));

const {
  buildActivationState,
  markEventActivated,
  markExplanationDismissed,
  resetActivationSeen,
  isDoublePointsLive,
  isTriplePointsLive,
} = require('../services/eventActivationService');

function makeUser(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    subscription: { tier: 'free' },
    liveEventActivations: [],
    markModified() {},
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('eventActivationService', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
    jest.clearAllMocks();
  });

  test('buildActivationState returns queue and bubbles sections', async () => {
    process.env.TRIPLE_POINTS_EVENT_ACTIVE = 'true';
    const user = makeUser();
    const state = await buildActivationState(user);

    expect(state).toHaveProperty('dayKey');
    expect(state).toHaveProperty('activationQueue');
    expect(state).toHaveProperty('activatedBubbles');
    expect(state).toHaveProperty('liveCount');
    expect(Array.isArray(state.activationQueue)).toBe(true);
    expect(Array.isArray(state.activatedBubbles)).toBe(true);
  });

  test('markEventActivated moves event from queue to bubbles', async () => {
    process.env.DOUBLE_POINTS_EVENT_ACTIVE = 'true';
    process.env.TRIPLE_POINTS_EVENT_ACTIVE = 'false';
    process.env.POINTS_EVENT_MULTIPLIER = '1';

    const user = makeUser();
    const before = await buildActivationState(user);
    expect(before.activationQueue.length).toBeGreaterThan(0);
    expect(before.activatedBubbles.length).toBe(0);

    const target = before.activationQueue[0];
    const after = await markEventActivated(user, {
      activationId: target.activationId,
      eventKey: target.eventKey,
    });

    expect(user.liveEventActivations.length).toBe(1);
    expect(after.activationQueue.some((e) => e.activationId === target.activationId)).toBe(false);
    expect(after.activatedBubbles.some((e) => e.activationId === target.activationId)).toBe(true);
    expect(user.save).toHaveBeenCalled();
  });

  test('markExplanationDismissed records dismiss state on activation row', async () => {
    process.env.DOUBLE_POINTS_EVENT_ACTIVE = 'true';
    process.env.TRIPLE_POINTS_EVENT_ACTIVE = 'false';
    process.env.POINTS_EVENT_MULTIPLIER = '1';

    const user = makeUser();
    const before = await buildActivationState(user);
    const target = before.activationQueue[0];
    await markEventActivated(user, {
      activationId: target.activationId,
      eventKey: target.eventKey,
    });

    const afterDismiss = await markExplanationDismissed(user, {
      activationId: target.activationId,
    });

    expect(user.liveEventActivations[0].explanationDismissedAt).toBeTruthy();
    expect(afterDismiss.activatedBubbles[0].explanationDismissed).toBe(true);
  });

  test('resetActivationSeen clears seen state', async () => {
    process.env.TRIPLE_POINTS_EVENT_ACTIVE = 'true';
    const user = makeUser({
      liveEventActivations: [
        {
          activationId: 'triple_points_2026-07-04',
          eventKey: 'triple_points',
          dayKey: '2026-07-04',
          activatedAt: new Date(),
        },
      ],
    });

    const after = await resetActivationSeen(user);
    expect(user.liveEventActivations).toEqual([]);
    expect(after.activationQueue.length).toBeGreaterThan(0);
    expect(after.activatedBubbles.length).toBe(0);
  });

  test('triple points takes priority over double points', async () => {
    process.env.TRIPLE_POINTS_EVENT_ACTIVE = 'true';
    process.env.DOUBLE_POINTS_EVENT_ACTIVE = 'true';

    const user = makeUser();
    const state = await buildActivationState(user);
    const keys = state.activationQueue.map((e) => e.eventKey);
    expect(keys).toContain('triple_points');
    expect(keys).not.toContain('double_points');
  });

  test('isDoublePointsLive and isTriplePointsLive respect env flags', () => {
    process.env.TRIPLE_POINTS_EVENT_ACTIVE = 'false';
    process.env.DOUBLE_POINTS_EVENT_ACTIVE = 'true';
    process.env.POINTS_EVENT_MULTIPLIER = '1';

    expect(isTriplePointsLive()).toBe(false);
    expect(isDoublePointsLive()).toBe(true);
  });
});
