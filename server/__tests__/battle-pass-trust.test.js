/**
 * Battle Pass trust tests — server-only events, forged client rejection, trusted hooks.
 *
 * Run: cd server && MONGODB_URI=mongodb://127.0.0.1:27017/final10_bp_trust_test npm run test:battle-pass-trust
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const BattlePassProgress = require('../models/BattlePassProgress');
const BattlePassEventLog = require('../models/BattlePassEventLog');
const SavvyTransaction = require('../models/SavvyTransaction');
const { creditSavvy } = require('../services/savvyBalanceService');
const { claimDailyStreak } = require('../services/dailyStreakService');
const { processBattlePassEvent } = require('../services/battlePassPersistenceService');
const { assertClientOriginEventAllowed } = require('../services/progressionTrustService');
const { claimTierReward } = require('../services/battlePassClaimService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

function forgedEvent(type, payload, id = 'client_forged_evt_001') {
  return { id, type, timestamp: Date.now(), payload };
}

async function waitForAsyncHooks(ms = 80) {
  await new Promise((r) => setTimeout(r, ms));
}

describeReal('Battle Pass trust (Phase 2 Item 2)', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;
  let prevNodeEnv;
  let prevTrustBypass;

  beforeAll(async () => {
    process.env.ENABLE_BATTLE_PASS_SERVER_EMIT = 'true';
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `bp_trust_${suffix}`,
      email: `bp_trust_${suffix}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      loginStreakDays: 0,
      lastLoginDay: null,
      lastDailyClaim: null,
    });
    await processBattlePassEvent(user._id, 'neon_hunt_s1', forgedEvent('auction_scanned', {
      auctionId: 'noop',
      secondsRemaining: 300,
      marketplace: 'ebay',
    }), { trustedServerOrigin: false }).catch(() => {});
    await BattlePassProgress.findOneAndUpdate(
      { userId: user._id, seasonId: 'neon_hunt_s1' },
      { $setOnInsert: { userId: user._id, seasonId: 'neon_hunt_s1' } },
      { upsert: true }
    );
  }, 60000);

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    prevTrustBypass = process.env.ALLOW_PROGRESSION_TRUST_BYPASS;
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_PROGRESSION_TRUST_BYPASS;
  });

  afterEach(() => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevTrustBypass === undefined) delete process.env.ALLOW_PROGRESSION_TRUST_BYPASS;
    else process.env.ALLOW_PROGRESSION_TRUST_BYPASS = prevTrustBypass;
  });

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await waitForAsyncHooks(500);
    delete process.env.ENABLE_BATTLE_PASS_SERVER_EMIT;
    try {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await BattlePassEventLog.deleteMany({ userId: user._id });
        await BattlePassProgress.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
    } finally {
      await mongoose.disconnect();
    }
  }, 30000);

  it('denies client-origin server-only event types in production trust mode', () => {
    const denied = assertClientOriginEventAllowed('savvy_points_earned');
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe('TRUST_SERVER_EVENT_ONLY');

    const allowed = assertClientOriginEventAllowed('auction_scanned');
    expect(allowed.ok).toBe(true);
  });

  it('rejects forged savvy_points_earned from HTTP-style client submission', async () => {
    const out = await processBattlePassEvent(
      user._id,
      'neon_hunt_s1',
      forgedEvent('savvy_points_earned', { amount: 99999, source: 'exploit' }, `forge_savvy_${suffix}`),
      { trustedServerOrigin: false }
    );
    expect(out.httpError?.status).toBe(403);
    expect(out.httpError?.body?.code).toBe('TRUST_SERVER_EVENT_ONLY');
  });

  it('rejects forged rank_changed and streak_updated from clients', async () => {
    const rank = await processBattlePassEvent(
      user._id,
      'neon_hunt_s1',
      forgedEvent('rank_changed', { previousRank: 100, newRank: 50 }, `forge_rank_${suffix}`),
      { trustedServerOrigin: false }
    );
    expect(rank.httpError?.status).toBe(403);

    const streak = await processBattlePassEvent(
      user._id,
      'neon_hunt_s1',
      forgedEvent('streak_updated', { streakType: 'login', days: 99 }, `forge_streak_${suffix}`),
      { trustedServerOrigin: false }
    );
    expect(streak.httpError?.status).toBe(403);
  });

  it('accepts trusted server-emitted savvy_points_earned after canonical creditSavvy', async () => {
    const u = await User.findById(user._id);
    const key = `bp_trust:savvy:${suffix}`;
    await creditSavvy(u, {
      amount: 200,
      source: 'test_bp_trust',
      idempotencyKey: key,
    });
    await waitForAsyncHooks(400);

    const srvLog = await BattlePassEventLog.findOne({
      userId: user._id,
      eventType: 'savvy_points_earned',
    }).lean();
    expect(srvLog).toBeTruthy();
    expect(srvLog.payload?.amount).toBe(200);

    const bp = await BattlePassProgress.findOne({ userId: user._id, seasonId: 'neon_hunt_s1' }).lean();
    const momentum = (bp?.taskProgress || []).find((t) => t.taskId === 'nh_weekly_momentum');
    expect(momentum?.progress || 0).toBeGreaterThanOrEqual(200);
  });

  it('accepts trusted daily_login and streak events after streak claim', async () => {
    const u = await User.findById(user._id);
    const result = await claimDailyStreak(u);
    expect(result.granted).toBe(true);
    await waitForAsyncHooks(400);

    const loginLog = await BattlePassEventLog.findOne({
      userId: user._id,
      eventType: 'daily_login_claimed',
    }).lean();
    expect(loginLog).toBeTruthy();
    expect(loginLog.payload?.rewardClaimed).toBe(true);

    const streakLog = await BattlePassEventLog.findOne({
      userId: user._id,
      eventType: 'streak_updated',
    }).lean();
    expect(streakLog).toBeTruthy();
    expect(streakLog.payload?.days).toBeGreaterThanOrEqual(1);
  });

  it('tier reward claims remain server-authoritative (not client-forged)', async () => {
    const bp = await BattlePassProgress.findOne({ userId: user._id, seasonId: 'neon_hunt_s1' });
    bp.xp = 5000;
    await bp.save();

    const out = await claimTierReward(user._id, { track: 'free', level: 2 });
    expect(out.ok).toBe(true);

    const refreshed = await BattlePassProgress.findOne({ userId: user._id, seasonId: 'neon_hunt_s1' }).lean();
    expect(refreshed.claimedRewardIds.some((k) => k.includes('tier2:free:2'))).toBe(true);
  });
});
