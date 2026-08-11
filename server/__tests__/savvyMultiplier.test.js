/**
 * Savvy earnings multiplier — authoritative stacking tests.
 */

jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

const {
  isDoublePointsLive,
  isTriplePointsLive,
} = require('../services/eventActivationService');
const { CORE_MULTIPLIER_CAP } = require('../config/savvyMultiplierConfig');
const {
  resolveSavvyMultiplierState,
  applySavvyMultiplier,
  activateMythicSavvyMultiplier,
  clearExpiredSavvyBoosts,
  readMythicSavvyBoost,
} = require('../services/savvyMultiplierService');
const { estimateDealReward } = require('../services/dealRewardService');

function user(overrides = {}) {
  return {
    _id: 'user-1',
    subscription: { tier: 'pro' },
    membershipTier: 'pro',
    powerMultiplier: 1,
    powerMultiplierBonus: 0,
    dealStreak: { currentDealStreak: 0 },
    savvyEcosystem: { savvyTrip: false, ezStay: false, aiGo: false },
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('1 — power 1.0 with no bonus', () => {
  beforeEach(() => {
    isDoublePointsLive.mockReturnValue(false);
    isTriplePointsLive.mockReturnValue(false);
  });

  it('core and effective are 1.0×', () => {
    const state = resolveSavvyMultiplierState(
      user({ subscription: { tier: 'free' }, membershipTier: 'free' })
    );
    expect(state.powerMultiplier).toBe(1);
    expect(state.coreMultiplier).toBe(1);
    expect(state.effectiveMultiplier).toBe(1);
  });
});

describe('2 — power affects payouts', () => {
  it('increases core multiplier with power above 1', () => {
    const state = resolveSavvyMultiplierState(
      user({ powerMultiplier: 1.5, powerMultiplierBonus: 0 })
    );
    expect(state.coreMultiplier).toBe(1.85); // 1.5 + 0.35 pro
    expect(applySavvyMultiplier(500, user({ powerMultiplier: 1.5 })).totalSavvy).toBe(925);
  });
});

describe('3 — ordinary bonuses add correctly', () => {
  it('sums power + subscription + ecosystem + deal streak', () => {
    const u = user({
      powerMultiplier: 1.5,
      subscription: { tier: 'pro' },
      savvyEcosystem: { savvyTrip: true, ezStay: true, aiGo: true },
      dealStreak: { currentDealStreak: 10 },
    });
    const state = resolveSavvyMultiplierState(u);
    // 1.5 + 0.35 + 1.0 + 0.15 = 3.0 (at cap)
    expect(state.coreMultiplier).toBe(3);
    expect(state.additiveBonuses.map((b) => b.type)).toEqual(
      expect.arrayContaining(['subscription', 'ecosystem', 'deal_streak'])
    );
  });
});

describe('4 — core cap', () => {
  it('clamps uncapped core to CORE_MULTIPLIER_CAP', () => {
    const u = user({
      powerMultiplier: 2.5,
      savvyEcosystem: { savvyTrip: true, ezStay: true, aiGo: true },
      dealStreak: { currentDealStreak: 10 },
    });
    const state = resolveSavvyMultiplierState(u);
    expect(state.capApplied).toBe(true);
    expect(state.coreMultiplier).toBe(CORE_MULTIPLIER_CAP);
  });
});

describe('5 — double points after core', () => {
  it('multiplies capped core by event multiplier', () => {
    isDoublePointsLive.mockReturnValue(true);
    const u = user({
      powerMultiplier: 1.5,
      subscription: { tier: 'pro' },
      dealStreak: { currentDealStreak: 10 },
      savvyEcosystem: { savvyTrip: true, ezStay: true, aiGo: false },
    });
    const state = resolveSavvyMultiplierState(u);
    // core = min(3, 1.5+0.35+0.35+0.15) = 2.35
    expect(state.coreMultiplier).toBe(2.35);
    expect(state.specialCombined).toBe(2.5); // pro double points
    expect(state.effectiveMultiplier).toBe(5.875);
  });
});

describe('6 — triple points after core', () => {
  it('uses triple event multiplier on core', () => {
    isTriplePointsLive.mockReturnValue(true);
    const u = user({ powerMultiplier: 1.5, subscription: { tier: 'pro' } });
    const state = resolveSavvyMultiplierState(u);
    expect(state.coreMultiplier).toBe(1.85);
    expect(state.specialCombined).toBe(3.75);
    expect(state.effectiveMultiplier).toBe(6.938);
  });
});

describe('7 — mythic 3× duration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('activates and expires server-side', () => {
    const u = user({ subscription: { tier: 'free' }, membershipTier: 'free' });
    activateMythicSavvyMultiplier(u);
    expect(readMythicSavvyBoost(u).active).toBe(true);
    expect(resolveSavvyMultiplierState(u).effectiveMultiplier).toBe(3);

    jest.setSystemTime(new Date('2026-08-10T18:01:00Z'));
    expect(readMythicSavvyBoost(u).active).toBe(false);
    clearExpiredSavvyBoosts(u);
    expect(u.savvyEarningBoosts.mythic3x).toBeUndefined();
  });
});

describe('8 — special stacking cannot explode', () => {
  it('uses max(mythic, event) not product when both active', () => {
    isTriplePointsLive.mockReturnValue(true);
    const u = user({ powerMultiplier: 1.5, subscription: { tier: 'pro' } });
    activateMythicSavvyMultiplier(u);
    const state = resolveSavvyMultiplierState(u);
    expect(state.specialCombined).toBe(3.75); // max(3, 3.75)
    expect(state.effectiveMultiplier).toBeLessThan(7);
  });
});

describe('9 — preview equals credit', () => {
  it('estimateDealReward total matches applySavvyMultiplier', async () => {
    isDoublePointsLive.mockReturnValue(true);
    const u = user({ powerMultiplier: 1.5, subscription: { tier: 'core' }, _id: undefined });
    const listing = { listingId: 'L1', trustScore: 90, savings: 100, price: 200 };
    const estimate = await estimateDealReward(u, listing);
    const applied = applySavvyMultiplier(estimate.baseSavvy, u);
    expect(estimate.totalSavvy).toBe(applied.totalSavvy);
    expect(estimate.effectiveMultiplier).toBe(applied.effectiveMultiplier);
  });
});

describe('10 — wallet effective equals payout multiplier', () => {
  it('state effectiveMultiplier matches apply ratio', () => {
    const u = user({ powerMultiplier: 1.2, dealStreak: { currentDealStreak: 5 } });
    const base = 500;
    const state = resolveSavvyMultiplierState(u);
    const payout = applySavvyMultiplier(base, u);
    expect(payout.totalSavvy / base).toBeCloseTo(state.effectiveMultiplier, 2);
  });
});

describe('11 — stable on repeated resolution', () => {
  it('returns identical values on repeat calls', () => {
    const u = user({ powerMultiplier: 1.4 });
    const a = resolveSavvyMultiplierState(u);
    const b = resolveSavvyMultiplierState(u);
    expect(a).toEqual(b);
  });
});

describe('12 — expired mythic cleared', () => {
  it('clearExpiredSavvyBoosts removes stale boost doc', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-10T12:00:00Z'));
    const u = user();
    activateMythicSavvyMultiplier(u);
    jest.setSystemTime(new Date('2026-08-10T20:00:00Z'));
    expect(clearExpiredSavvyBoosts(u)).toBe(true);
    jest.useRealTimers();
  });
});

describe('13 — rounding consistent', () => {
  it('rounds final savvy to integer', () => {
    const u = user({ powerMultiplier: 1.33, subscription: { tier: 'core' } });
    const payout = applySavvyMultiplier(113, u);
    expect(Number.isInteger(payout.totalSavvy)).toBe(true);
    expect(payout.totalSavvy).toBe(Math.round(113 * payout.effectiveMultiplier));
  });
});

describe('14 — example calculations', () => {
  beforeEach(() => {
    isDoublePointsLive.mockReturnValue(false);
    isTriplePointsLive.mockReturnValue(false);
  });

  it('uses existing product additive values (pro +0.35, 1-app ecosystem +0.12, streak +0.15)', () => {
    const u = user({
      powerMultiplier: 1.5,
      subscription: { tier: 'pro' },
      savvyEcosystem: { savvyTrip: true, ezStay: false, aiGo: false },
      dealStreak: { currentDealStreak: 10 },
    });
    const state = resolveSavvyMultiplierState(u);
    expect(state.coreMultiplier).toBe(2.12);
    expect(applySavvyMultiplier(500, u).totalSavvy).toBe(1060);
  });

  it('core × tier-adjusted double points on existing additive values', () => {
    isDoublePointsLive.mockReturnValue(true);
    const u = user({
      powerMultiplier: 1.5,
      subscription: { tier: 'pro' },
      savvyEcosystem: { savvyTrip: true, ezStay: false, aiGo: false },
      dealStreak: { currentDealStreak: 10 },
    });
    const state = resolveSavvyMultiplierState(u);
    expect(state.coreMultiplier).toBe(2.12);
    expect(state.specialCombined).toBe(2.5);
    expect(state.effectiveMultiplier).toBe(5.3);
    expect(applySavvyMultiplier(500, u).totalSavvy).toBe(2650);
  });
});

describe('Master Collection bonus', () => {
  beforeEach(() => {
    isDoublePointsLive.mockReturnValue(false);
    isTriplePointsLive.mockReturnValue(false);
  });

  it('adds +0.25× as Master Collection Bonus when mastery savvy bonus is granted', () => {
    const u = user({
      subscription: { tier: 'free' },
      membershipTier: 'free',
      masterClassifiedProgress: { savvyBonusGranted: true },
    });
    const state = resolveSavvyMultiplierState(u);
    const masterBonus = state.additiveBonuses.find((b) => b.type === 'master_collection');
    expect(masterBonus).toMatchObject({
      label: 'Master Collection Bonus',
      amount: 0.25,
    });
    expect(state.coreMultiplier).toBe(1.25);
  });

  it('respects core multiplier cap with master collection bonus', () => {
    const u = user({
      powerMultiplier: 2.5,
      subscription: { tier: 'pro' },
      savvyEcosystem: { savvyTrip: true, ezStay: true, aiGo: true },
      dealStreak: { currentDealStreak: 10 },
      masterClassifiedProgress: { savvyBonusGranted: true },
    });
    const state = resolveSavvyMultiplierState(u);
    expect(state.capApplied).toBe(true);
    expect(state.coreMultiplier).toBe(CORE_MULTIPLIER_CAP);
  });
});
