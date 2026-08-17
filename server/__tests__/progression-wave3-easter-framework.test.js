/**
 * Wave 3 closure — Easter Challenge framework verification.
 */
jest.mock('../services/savvyRewardService', () => ({
  grantSavvyReward: jest.fn(async (user, opts) => {
    const amount = Number(opts.amount) || 0;
    user.savvyPoints = (Number(user.savvyPoints) || 0) + amount;
    return { granted: true, amount, duplicate: false, newBalance: user.savvyPoints };
  }),
  spendSavvyReward: jest.fn(),
}));

const {
  EASTER_CHALLENGES,
  EASTER_CHALLENGE_REWARDS,
  getPublicEasterChallenges,
} = require('../config/easterChallengeConfig');
const {
  activateEasterChallenge,
  claimEasterChallengeReward,
  readActiveChallenge,
  serializeEasterChallengePublic,
  ensureEasterChallengeDoc,
} = require('../services/easterChallengeService');

function mockUser(overrides = {}) {
  return {
    _id: 'easter-user',
    savvyPoints: 0,
    easterChallenge: {},
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Easter Challenge — framework complete / content deferred', () => {
  test('registry exists with configurable Savvy reward range support', () => {
    expect(EASTER_CHALLENGE_REWARDS.savvyMin).toBe(5000);
    expect(EASTER_CHALLENGE_REWARDS.savvyMax).toBe(10000);
    expect(EASTER_CHALLENGES.length).toBeGreaterThan(0);
    expect(EASTER_CHALLENGES[0].rewards.savvy).toBeGreaterThanOrEqual(5000);
  });

  test('server-authoritative activation with idempotency', async () => {
    const user = mockUser();
    const first = await activateEasterChallenge(user, 'wave3_placeholder', {
      idempotencyKey: 'act-1',
      adminBypass: true,
    });
    expect(first.activated).toBe(true);
    expect(first.expiresAt).toBeTruthy();

    const dup = await activateEasterChallenge(user, 'wave3_placeholder', {
      idempotencyKey: 'act-1',
      adminBypass: true,
    });
    expect(dup.duplicate).toBe(true);
  });

  test('one active challenge slot with expiration tracking', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-17T12:00:00Z'));

    const user = mockUser();
    await activateEasterChallenge(user, 'wave3_placeholder', {
      idempotencyKey: 'slot-1',
      adminBypass: true,
    });

    const active = readActiveChallenge(user);
    expect(active.expired).toBe(false);
    expect(active.challengeId).toBe('wave3_placeholder');

    jest.setSystemTime(new Date('2026-08-18T13:00:00Z'));
    const expired = readActiveChallenge(user);
    expect(expired.expired).toBe(true);

    jest.useRealTimers();
  });

  test('completion claim is idempotent with FIXED Savvy reward', async () => {
    const user = mockUser();
    const ec = ensureEasterChallengeDoc(user);
    ec.activeChallengeId = 'wave3_placeholder';
    ec.activeChallengeProgress = 3;
    ec.activeChallengeTarget = 3;

    const first = await claimEasterChallengeReward(user, {
      idempotencyKey: 'claim-1',
      challengeId: 'wave3_placeholder',
    });
    expect(first.claimed).toBe(true);
    expect(first.savvyGranted).toBe(5000);

    const dup = await claimEasterChallengeReward(user, {
      idempotencyKey: 'claim-1',
      challengeId: 'wave3_placeholder',
    });
    expect(dup.duplicate).toBe(true);
  });

  test('admin-only placeholder is not exposed publicly', () => {
    expect(getPublicEasterChallenges().length).toBe(0);

    const user = mockUser();
    user.easterChallenge = {
      activeChallengeId: 'wave3_placeholder',
      activeChallengeExpiresAt: new Date(Date.now() + 3600000),
      activeChallengeProgress: 0,
      activeChallengeTarget: 3,
    };

    const pub = serializeEasterChallengePublic(user);
    expect(pub.visible).toBe(false);
    expect(pub.classified).toBe(true);
  });

  test('non-admin activation of admin-only challenge is rejected', async () => {
    const user = mockUser();
    await expect(
      activateEasterChallenge(user, 'wave3_placeholder', { idempotencyKey: 'no-admin' })
    ).rejects.toMatchObject({ code: 'CHALLENGE_NOT_PUBLIC' });
  });

  test('optional cosmetic reward fields exist in config schema', () => {
    const challenge = EASTER_CHALLENGES[0];
    expect(challenge.rewards).toHaveProperty('emblemId');
    expect(challenge.rewards).toHaveProperty('callingCardId');
    expect(challenge.rewards).toHaveProperty('outfitId');
  });
});
