const {
  LIVE_WELCOME_BONUS_AMOUNT,
  LIVE_WELCOME_BONUS_SOURCE,
  isStreamQrAttribution,
  normalizeAttributionSource,
  sanitizeEventSlug,
  buildSavvyWatchJoinUrl,
  getSavvyWatchPublicBaseUrl,
} = require('../config/savvyWatchConfig');
const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');
const { buildLiveWelcomeIdempotencyKey, claimLiveWelcomeBonus } = require('../services/savvyWatchLiveWelcomeBonusService');
const SavvyWatchEvent = require('../models/SavvyWatchEvent');

describe('Savvy Watch Live Welcome Bonus config', () => {
  test('uses fixed 500 Savvy amount and stream-qr source', () => {
    expect(LIVE_WELCOME_BONUS_AMOUNT).toBe(500);
    expect(LIVE_WELCOME_BONUS_SOURCE).toBe('stream-qr');
  });

  test('recognizes stream-qr attribution from src or source aliases', () => {
    expect(isStreamQrAttribution('stream-qr')).toBe(true);
    expect(isStreamQrAttribution('STREAM-QR')).toBe(true);
    expect(isStreamQrAttribution('direct')).toBe(false);
    expect(normalizeAttributionSource('stream-qr')).toBe('stream-qr');
  });

  test('builds production join URL with source=stream-qr', () => {
    delete process.env.SAVVY_WATCH_PUBLIC_URL;
    delete process.env.CLIENT_URL;
    const url = buildSavvyWatchJoinUrl('gta-car-meet-001', { useSourceParam: true });
    expect(url).toBe('https://final10.app/watch/gta-car-meet-001?source=stream-qr');
  });

  test('sanitizes valid event slugs and rejects invalid slugs', () => {
    expect(sanitizeEventSlug('GTA-Car-Meet-001')).toBe('gta-car-meet-001');
    expect(() => sanitizeEventSlug('../evil')).toThrow('Invalid event slug');
  });

  test('live welcome bonus reward type is fixed (no multiplier)', () => {
    const policy = getRewardPolicy('savvy_watch_live_welcome_bonus');
    expect(policy).toBeTruthy();
    expect(policy.rewardClass).toBe(REWARD_CLASS.FIXED);
  });

  test('idempotency key is one-per-user globally', () => {
    const userId = '507f1f77bcf86cd799439011';
    expect(buildLiveWelcomeIdempotencyKey(userId)).toBe(`savvy_watch_live_welcome:${userId}`);
  });

  test('public base URL prefers SAVVY_WATCH_PUBLIC_URL then CLIENT_URL', () => {
    process.env.SAVVY_WATCH_PUBLIC_URL = 'https://final10.app';
    expect(getSavvyWatchPublicBaseUrl()).toBe('https://final10.app');
    delete process.env.SAVVY_WATCH_PUBLIC_URL;
  });

  test('ended event does not award signup bonus', async () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    const findSpy = jest.spyOn(SavvyWatchEvent, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        eventId: 'sw_end',
        slug: 'gta-car-meet-001',
        status: 'ended',
      }),
    });
    const user = { _id: '507f1f77bcf86cd799439011', savvyPoints: 100 };
    const result = await claimLiveWelcomeBonus(user, 'gta-car-meet-001', { source: 'stream-qr' });
    expect(result.awarded).toBe(false);
    expect(result.reason).toBe('EVENT_ENDED');
    expect(result.savvyAmount).toBe(0);
    findSpy.mockRestore();
  });
});

const mongoose = require('mongoose');
const User = require('../models/User');
const SavvyWatchLiveWelcomeRedemption = require('../models/SavvyWatchLiveWelcomeRedemption');
const SavvyTransaction = require('../models/SavvyTransaction');
const { grantSavvyReward } = require('../services/savvyRewardService');
const { resolveAuthoritativeSavvyPayout } = require('../services/savvyMultiplierService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describeReal('Savvy Watch Live Welcome Bonus integration', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;
  let event;

  beforeAll(async () => {
    process.env.SAVVY_WATCH_ENABLED = 'true';
    process.env.SAVVY_WATCH_ADMIN_ONLY = 'false';
    await mongoose.connect(MONGODB_URI);

    user = await User.create({
      username: `swqr_${suffix}`,
      email: `swqr_${suffix}@test.local`,
      savvyPoints: 100,
      pointsBalance: 100,
      lifetimePointsEarned: 100,
      points: 0,
      dailyTasks: { completed: {}, pointsEarned: 0 },
    });

    event = await SavvyWatchEvent.create({
      eventId: `sw_test_${suffix}`,
      slug: `gta-qr-test-${suffix}`,
      title: 'QR Test Event',
      status: 'live',
      rewardBudget: 0,
      rewardRules: { checkpoints: [], maxSavvyPerViewer: 100 },
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await SavvyWatchLiveWelcomeRedemption.deleteMany({ userId: user?._id });
    await SavvyTransaction.deleteMany({ userId: user?._id });
    if (event?.eventId) await SavvyWatchEvent.deleteOne({ eventId: event.eventId });
    if (user?._id) await User.deleteOne({ _id: user._id });
    await mongoose.disconnect();
  }, 30000);

  async function reloadUser() {
    return User.findById(user._id);
  }

  it('awards exactly 500 Savvy for eligible stream-qr claim', async () => {
    const before = await reloadUser();
    const result = await claimLiveWelcomeBonus(before, event.slug, { source: 'stream-qr' });
    expect(result.awarded).toBe(true);
    expect(result.savvyAmount).toBe(500);
    expect(result.newBalance).toBe(600);

    const after = await reloadUser();
    expect(after.savvyPoints).toBe(600);

    const redemption = await SavvyWatchLiveWelcomeRedemption.findOne({ userId: user._id }).lean();
    expect(redemption).toBeTruthy();
    expect(redemption.amount).toBe(500);
    expect(redemption.source).toBe('stream-qr');
    expect(redemption.eventSlug).toBe(event.slug);
  });

  it('does not award again on repeat claim (re-scan / refresh)', async () => {
    const before = await reloadUser();
    const result = await claimLiveWelcomeBonus(before, event.slug, { source: 'stream-qr' });
    expect(result.awarded).toBe(false);
    expect(result.alreadyClaimed).toBe(true);
    expect(result.savvyAmount).toBe(0);

    const after = await reloadUser();
    expect(after.savvyPoints).toBe(600);
  });

  it('does not award for non-stream-qr source', async () => {
    const other = await User.create({
      username: `swqr2_${suffix}`,
      email: `swqr2_${suffix}@test.local`,
      savvyPoints: 50,
      pointsBalance: 50,
      lifetimePointsEarned: 50,
      points: 0,
      dailyTasks: { completed: {}, pointsEarned: 0 },
    });
    const result = await claimLiveWelcomeBonus(other, event.slug, { source: 'direct' });
    expect(result.awarded).toBe(false);
    expect(result.savvyAmount).toBe(0);
    await User.deleteOne({ _id: other._id });
  });

  it('does not award for invalid event slug', async () => {
    const other = await User.create({
      username: `swqr3_${suffix}`,
      email: `swqr3_${suffix}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      points: 0,
      dailyTasks: { completed: {}, pointsEarned: 0 },
    });
    await expect(claimLiveWelcomeBonus(other, '../missing', { source: 'stream-qr' })).rejects.toMatchObject({
      code: 'INVALID_EVENT_SLUG',
    });
    await User.deleteOne({ _id: other._id });
  });

  it('concurrent claims only grant 500 total', async () => {
    const concurrentUser = await User.create({
      username: `swqr4_${suffix}`,
      email: `swqr4_${suffix}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      points: 0,
      dailyTasks: { completed: {}, pointsEarned: 0 },
    });

    const fresh = await User.findById(concurrentUser._id);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimLiveWelcomeBonus(fresh, event.slug, { source: 'stream-qr' }))
    );

    const awardedCount = results.filter((r) => r.awarded).length;
    expect(awardedCount).toBe(1);

    const finalUser = await User.findById(concurrentUser._id);
    expect(finalUser.savvyPoints).toBe(500);

    await SavvyWatchLiveWelcomeRedemption.deleteMany({ userId: concurrentUser._id });
    await SavvyTransaction.deleteMany({ userId: concurrentUser._id });
    await User.deleteOne({ _id: concurrentUser._id });
  });

  it('multiplier policy keeps live welcome bonus at exactly 500', async () => {
    const payout = resolveAuthoritativeSavvyPayout({
      user: { subscriptionTier: 'legend', loginStreakDays: 30 },
      baseAmount: 500,
      rewardType: 'savvy_watch_live_welcome_bonus',
      applyRewardPolicy: true,
    });
    expect(payout.finalAmount).toBe(500);
    expect(payout.effectiveMultiplier).toBe(1);
  });
});
