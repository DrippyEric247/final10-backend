/**
 * Wave 1 — Economy Truth tests (A–L).
 * Unit tests run without MongoDB; integration blocks require MONGODB_URI.
 *
 * Run: cd server && npm test -- economy-truth-wave1.test.js
 */

jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

const mongoose = require('mongoose');
const User = require('../models/User');
const SavvyTransaction = require('../models/SavvyTransaction');
const {
  isDoublePointsLive,
  isTriplePointsLive,
} = require('../services/eventActivationService');
const {
  applySavvyMultiplier,
  calculateSavvyReward,
  resolveSavvyMultiplierState,
  activateMythicSavvyMultiplier,
  clearExpiredSavvyBoosts,
} = require('../services/savvyMultiplierService');
const { creditSavvy, debitSavvy, InsufficientSavvyError } = require('../services/savvyBalanceService');
const { estimateDealReward } = require('../services/dealRewardService');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

function mockUser(overrides = {}) {
  return {
    _id: 'user-wave1',
    subscription: { tier: 'free' },
    membershipTier: 'free',
    powerMultiplier: 1,
    powerMultiplierBonus: 0,
    dealStreak: { currentDealStreak: 0 },
    savvyEcosystem: { savvyTrip: false, ezStay: false, aiGo: false },
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  isDoublePointsLive.mockReturnValue(false);
  isTriplePointsLive.mockReturnValue(false);
  jest.useRealTimers();
});

describe('A — base reward @ 1×', () => {
  it('100 Savvy @ 1× = 100 for fixed source', () => {
    const u = mockUser({ subscription: { tier: 'free' }, membershipTier: 'free' });
    const result = calculateSavvyReward(u, 100, { source: 'perk_machine' });
    expect(result.appliedMultiplier).toBe(1);
    expect(result.finalAmount).toBe(100);
  });
});

describe('B — real multiplier 2.7× on earning source', () => {
  it('100 Savvy @ 2.7× = 270 via deal_purchase', () => {
    const u = mockUser({
      powerMultiplier: 1,
      powerMultiplierBonus: 1.7,
      subscription: { tier: 'free' },
      membershipTier: 'free',
    });
    const result = calculateSavvyReward(u, 100, { source: 'deal_purchase' });
    expect(result.appliedMultiplier).toBe(2.7);
    expect(result.finalAmount).toBe(270);
  });
});

describe('C — preview/payout parity', () => {
  it('calculateSavvyReward matches applySavvyMultiplier for earning sources', () => {
    const u = mockUser({ powerMultiplier: 1.4, subscription: { tier: 'core' } });
    const preview = calculateSavvyReward(u, 500, { source: 'deal_purchase' });
    const payout = applySavvyMultiplier(500, u);
    expect(preview.finalAmount).toBe(payout.totalSavvy);
    expect(preview.appliedMultiplier).toBe(payout.effectiveMultiplier);
  });

  it('estimateDealReward total matches calculateSavvyReward for same base', async () => {
    const u = mockUser({ powerMultiplier: 1.5, subscription: { tier: 'pro' }, _id: undefined });
    const listing = { listingId: 'L-parity', trustScore: 90, savings: 100, price: 200 };
    const estimate = await estimateDealReward(u, listing);
    const calc = calculateSavvyReward(u, estimate.baseSavvy, { source: 'deal_purchase' });
    expect(estimate.totalSavvy).toBe(calc.finalAmount);
  });
});

describe('D — idempotency (integration)', () => {
  describeReal('duplicate credit key pays once', () => {
    let user;

    beforeAll(async () => {
      await mongoose.connect(MONGODB_URI);
    }, 60000);

    afterAll(async () => {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await mongoose.disconnect();
    }, 30000);

    it('same idempotency key submitted twice = paid once', async () => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      user = await User.create({
        username: `wave1_idem_${suffix}`,
        email: `wave1_idem_${suffix}@test.local`,
        savvyPoints: 100,
        pointsBalance: 100,
      });
      const key = `wave1_idem_${suffix}`;

      const first = await creditSavvy(user, { amount: 50, source: 'wave1_test', idempotencyKey: key });
      const second = await creditSavvy(user, { amount: 50, source: 'wave1_test', idempotencyKey: key });

      expect(first.granted).toBe(true);
      expect(second.duplicate).toBe(true);
      expect(second.granted).toBe(false);

      const refreshed = await User.findById(user._id).lean();
      expect(refreshed.savvyPoints).toBe(150);
    });
  });
});

describe('E — spend', () => {
  describeReal('balance 1000 spend 60 = 940', () => {
    let user;

    beforeAll(async () => {
      await mongoose.connect(MONGODB_URI);
    }, 60000);

    afterAll(async () => {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await mongoose.disconnect();
    }, 30000);

    it('debits canonical balance', async () => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      user = await User.create({
        username: `wave1_spend_${suffix}`,
        email: `wave1_spend_${suffix}@test.local`,
        savvyPoints: 1000,
        pointsBalance: 1000,
      });

      const result = await debitSavvy(user, {
        amount: 60,
        source: 'wave1_spend_test',
        idempotencyKey: `wave1_spend_${suffix}`,
      });

      expect(result.granted).toBe(true);
      expect(result.newBalance).toBe(940);
    });
  });
});

describe('F — insufficient balance', () => {
  describeReal('cannot go negative', () => {
    let user;

    beforeAll(async () => {
      await mongoose.connect(MONGODB_URI);
    }, 60000);

    afterAll(async () => {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await mongoose.disconnect();
    }, 30000);

    it('throws InsufficientSavvyError', async () => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      user = await User.create({
        username: `wave1_insuf_${suffix}`,
        email: `wave1_insuf_${suffix}@test.local`,
        savvyPoints: 50,
        pointsBalance: 50,
      });

      await expect(
        debitSavvy(user, {
          amount: 100,
          source: 'wave1_insuf_test',
          idempotencyKey: `wave1_insuf_${suffix}`,
        })
      ).rejects.toBeInstanceOf(InsufficientSavvyError);

      const refreshed = await User.findById(user._id).lean();
      expect(refreshed.savvyPoints).toBe(50);
    });
  });
});

describe('G — event modifier via authoritative resolver', () => {
  it('Double Points uses resolveSavvyMultiplierState on earning source', () => {
    isDoublePointsLive.mockReturnValue(true);
    const u = mockUser({ powerMultiplier: 1.5, subscription: { tier: 'pro' } });
    const state = resolveSavvyMultiplierState(u);
    expect(state.specialCombined).toBeGreaterThan(1);
    const result = calculateSavvyReward(u, 100, { source: 'deal_purchase' });
    expect(result.finalAmount).toBe(Math.round(100 * state.effectiveMultiplier));
  });

  it('Triple Points uses resolveSavvyMultiplierState on earning source', () => {
    isTriplePointsLive.mockReturnValue(true);
    const u = mockUser({ powerMultiplier: 1.5, subscription: { tier: 'pro' } });
    const state = resolveSavvyMultiplierState(u);
    expect(state.eventKey).toBe('triple_points');
    expect(calculateSavvyReward(u, 100, { source: 'deal_purchase' }).finalAmount).toBe(
      Math.round(100 * state.effectiveMultiplier)
    );
  });
});

describe('H — Savvy Power affects earning payout only', () => {
  it('powerMultiplierBonus increases deal earnings but not perk machine', () => {
    const base = mockUser({ powerMultiplier: 1, powerMultiplierBonus: 0 });
    const boosted = mockUser({ powerMultiplier: 1, powerMultiplierBonus: 0.5 });
    const baseDeal = calculateSavvyReward(base, 200, { source: 'deal_purchase' }).finalAmount;
    const boostedDeal = calculateSavvyReward(boosted, 200, { source: 'deal_purchase' }).finalAmount;
    expect(boostedDeal).toBeGreaterThan(baseDeal);
    expect(boostedDeal).toBe(300);
    expect(calculateSavvyReward(boosted, 200, { source: 'perk_machine' }).finalAmount).toBe(200);
  });
});

describe('I — transaction on successful mutation', () => {
  describeReal('creates SavvyTransaction row', () => {
    let user;

    beforeAll(async () => {
      await mongoose.connect(MONGODB_URI);
    }, 60000);

    afterAll(async () => {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await mongoose.disconnect();
    }, 30000);

    it('records completed transaction with balance after', async () => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      user = await User.create({
        username: `wave1_txn_${suffix}`,
        email: `wave1_txn_${suffix}@test.local`,
        savvyPoints: 0,
        pointsBalance: 0,
      });
      const key = `wave1_txn_${suffix}`;

      await creditSavvy(user, { amount: 42, source: 'wave1_txn', idempotencyKey: key });

      const txn = await SavvyTransaction.findOne({ idempotencyKey: key }).lean();
      expect(txn).toBeTruthy();
      expect(txn.status).toBe('completed');
      expect(txn.amount).toBe(42);
      expect(txn.balanceAfter).toBe(42);
    });
  });
});

describe('J — concurrent duplicate claims', () => {
  describeReal('must not double-credit', () => {
    let user;

    beforeAll(async () => {
      await mongoose.connect(MONGODB_URI);
    }, 60000);

    afterAll(async () => {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await mongoose.disconnect();
    }, 30000);

    it('parallel credits with same key grant once', async () => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      user = await User.create({
        username: `wave1_conc_${suffix}`,
        email: `wave1_conc_${suffix}@test.local`,
        savvyPoints: 0,
        pointsBalance: 0,
      });
      const key = `wave1_conc_${suffix}`;

      const results = await Promise.all([
        creditSavvy(user._id, { amount: 75, source: 'wave1_conc', idempotencyKey: key }),
        creditSavvy(user._id, { amount: 75, source: 'wave1_conc', idempotencyKey: key }),
        creditSavvy(user._id, { amount: 75, source: 'wave1_conc', idempotencyKey: key }),
      ]);

      const granted = results.filter((r) => r.granted).length;
      expect(granted).toBe(1);

      const refreshed = await User.findById(user._id).lean();
      expect(refreshed.savvyPoints).toBe(75);
    });
  });
});

describe('K — expired temporary multiplier', () => {
  it('mythic boost does not affect earning payout after expiration', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T12:00:00Z'));

    const u = mockUser();
    activateMythicSavvyMultiplier(u);
    expect(calculateSavvyReward(u, 100, { source: 'deal_purchase' }).appliedMultiplier).toBe(3);

    jest.setSystemTime(new Date('2026-08-10T18:01:00Z'));
    clearExpiredSavvyBoosts(u);
    expect(calculateSavvyReward(u, 100, { source: 'deal_purchase' }).appliedMultiplier).toBe(1);

    jest.useRealTimers();
  });
});

describe('L — balance sync', () => {
  describeReal('server-returned balance matches User.savvyPoints', () => {
    let user;

    beforeAll(async () => {
      await mongoose.connect(MONGODB_URI);
    }, 60000);

    afterAll(async () => {
      if (user?._id) {
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await mongoose.disconnect();
    }, 30000);

    it('creditSavvy newBalance equals persisted savvyPoints', async () => {
      const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      user = await User.create({
        username: `wave1_sync_${suffix}`,
        email: `wave1_sync_${suffix}@test.local`,
        savvyPoints: 500,
        pointsBalance: 500,
      });

      const result = await creditSavvy(user, {
        amount: 25,
        source: 'wave1_sync',
        idempotencyKey: `wave1_sync_${suffix}`,
      });

      const refreshed = await User.findById(user._id).lean();
      expect(result.newBalance).toBe(525);
      expect(refreshed.savvyPoints).toBe(525);
      expect(user.savvyPoints).toBe(525);
    });
  });
});
