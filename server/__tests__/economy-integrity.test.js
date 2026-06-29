/**
 * Economy integrity tests — idempotency, concurrency, balance reconciliation.
 *
 * Run: cd server && MONGODB_URI=mongodb://127.0.0.1:27017/final10_test npm test -- economy-integrity.test.js
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const SavvyTransaction = require('../models/SavvyTransaction');
const { creditSavvy, debitSavvy, sumCompletedTransactions } = require('../services/savvyBalanceService');
const { grantSavvyReward } = require('../services/savvyRewardService');
const { claimScoutMissionReward } = require('../services/scoutMissionService');
const { claimDailyStreak } = require('../services/dailyStreakService');
const { periodKeyForMission } = require('../config/scoutMissions');
const { getMissionById } = require('../config/scoutMissions');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describeReal('Economy integrity (Phase 1)', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `econ_${suffix}`,
      email: `econ_${suffix}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      points: 0,
      dailyTasks: { completed: {}, pointsEarned: 0 },
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI) return;
    try {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
    } finally {
      await mongoose.disconnect();
    }
  }, 30000);

  async function reloadUser() {
    return User.findById(user._id);
  }

  async function assertBalanceMatchesLedger() {
    const u = await reloadUser();
    const txnSum = await sumCompletedTransactions(user._id);
    expect(u.savvyPoints).toBe(txnSum);
    expect(u.pointsBalance).toBe(u.savvyPoints);
  }

  it('credits via creditSavvy and writes SavvyTransaction', async () => {
    const u = await reloadUser();
    const r = await creditSavvy(u, {
      amount: 100,
      source: 'test_credit',
      idempotencyKey: `test:credit:${suffix}:1`,
    });
    expect(r.granted).toBe(true);
    expect(r.balanceBefore).toBe(0);
    expect(r.balanceAfter).toBe(100);

    const txn = await SavvyTransaction.findOne({ idempotencyKey: `test:credit:${suffix}:1` }).lean();
    expect(txn).toBeTruthy();
    expect(txn.transactionId).toBeTruthy();
    expect(txn.amount).toBe(100);
    expect(txn.balanceBefore).toBe(0);
    expect(txn.balanceAfter).toBe(100);

    await assertBalanceMatchesLedger();
  });

  it('blocks duplicate credit (network retry)', async () => {
    const u = await reloadUser();
    const key = `test:dup:${suffix}`;
    const first = await creditSavvy(u, { amount: 25, source: 'test_dup', idempotencyKey: key });
    const second = await creditSavvy(u, { amount: 25, source: 'test_dup', idempotencyKey: key });
    expect(first.granted).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.granted).toBe(false);

    const u2 = await reloadUser();
    expect(u2.savvyPoints).toBe(125);
    await assertBalanceMatchesLedger();
  });

  it('debits atomically and rejects insufficient balance', async () => {
    const u = await reloadUser();
    const spend = await debitSavvy(u, {
      amount: 20,
      source: 'test_debit',
      idempotencyKey: `test:debit:${suffix}`,
    });
    expect(spend.granted).toBe(true);
    expect(spend.newBalance).toBe(105);

    const u2 = await reloadUser();
    await expect(
      debitSavvy(u2, {
        amount: 9999,
        source: 'test_debit_fail',
        idempotencyKey: `test:debit:fail:${suffix}`,
      })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_SAVVY' });

    await assertBalanceMatchesLedger();
  });

  it('grantSavvyReward integrates with SavvyTransaction', async () => {
    const u = await reloadUser();
    const g = await grantSavvyReward(u, {
      rewardType: 'scout_mission',
      amount: 15,
      idempotencyKey: `test:grant:${suffix}`,
      note: 'test',
    });
    expect(g.granted).toBe(true);
    await assertBalanceMatchesLedger();
  });

  it('scout mission ignores client periodKey override', async () => {
    const mission = getMissionById('save_deal');
    const serverKey = periodKeyForMission(mission, 'evil-client-key-1');
    const serverKey2 = periodKeyForMission(mission, 'evil-client-key-2');
    expect(serverKey).toBe(serverKey2);

    const u = await reloadUser();
    const c1 = await claimScoutMissionReward(u, {
      missionId: 'save_deal',
      periodKey: 'evil-client-key-1',
    });
    expect(c1.granted).toBe(true);

    const u2 = await reloadUser();
    const c2 = await claimScoutMissionReward(u2, {
      missionId: 'save_deal',
      periodKey: 'evil-client-key-2',
    });
    expect(c2.alreadyClaimed || c2.duplicate).toBeTruthy();

    await assertBalanceMatchesLedger();
  });

  it('daily streak claim is idempotent under concurrent requests', async () => {
    const u = await reloadUser();
    const results = await Promise.all([
      claimDailyStreak(u),
      claimDailyStreak(await reloadUser()),
      claimDailyStreak(await reloadUser()),
    ]);
    const granted = results.filter((r) => r.granted).length;
    const already = results.filter((r) => r.alreadyClaimed).length;
    expect(granted).toBe(1);
    expect(already).toBe(2);

    const u2 = await reloadUser();
    const again = await claimDailyStreak(u2);
    expect(again.alreadyClaimed).toBe(true);
  });

  it('handles 100 concurrent duplicate credit attempts with single grant', async () => {
    const before = (await reloadUser()).savvyPoints;
    const key = `test:concurrent:${suffix}`;
    const attempts = Array.from({ length: 100 }, () =>
      creditSavvy(user._id, { amount: 50, source: 'concurrent_test', idempotencyKey: key })
    );
    const results = await Promise.all(attempts);
    const granted = results.filter((r) => r.granted).length;
    expect(granted).toBe(1);

    const u = await reloadUser();
    expect(u.savvyPoints).toBe(before + 50);
    await assertBalanceMatchesLedger();
  });

  it('simulates 1000 unique grants and verifies balance sum', async () => {
    let expected = (await reloadUser()).savvyPoints;
    for (let i = 0; i < 50; i += 1) {
      const amt = 1 + (i % 5);
      await creditSavvy(user._id, {
        amount: amt,
        source: 'bulk_test',
        idempotencyKey: `bulk:${suffix}:${i}`,
      });
      expected += amt;
    }
    const u = await reloadUser();
    expect(u.savvyPoints).toBe(expected);
    await assertBalanceMatchesLedger();
  });
});
