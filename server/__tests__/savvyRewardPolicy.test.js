/**
 * Multiplier eligibility policy regression tests.
 *
 * Run: cd server && npm test -- savvyRewardPolicy.test.js
 */

jest.mock('../services/eventActivationService', () => ({
  isDoublePointsLive: jest.fn(() => false),
  isTriplePointsLive: jest.fn(() => false),
}));

const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');
const {
  resolveAuthoritativeSavvyPayout,
  resolveSavvyMultiplierState,
} = require('../services/savvyMultiplierService');
const { grantSavvyReward } = require('../services/savvyRewardService');

function user(overrides = {}) {
  return {
    _id: 'policy-user',
    subscription: { tier: 'pro' },
    membershipTier: 'pro',
    powerMultiplier: 1,
    powerMultiplierBonus: 1.7,
    dealStreak: { currentDealStreak: 0 },
    savvyEcosystem: { savvyTrip: false, ezStay: false, aiGo: false },
    savvyPoints: 0,
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** User with ~2.7× effective earning multiplier (pro + power bonus). */
function boostedUser() {
  return user({ powerMultiplier: 1, powerMultiplierBonus: 1.7, subscription: { tier: 'pro' } });
}

/** User with 2.0× effective earning multiplier. */
function doubleUser() {
  return user({
    powerMultiplier: 2,
    powerMultiplierBonus: 0,
    subscription: { tier: 'free' },
    membershipTier: 'free',
  });
}

describe('getRewardPolicy registry', () => {
  it('classifies perk_machine as fixed', () => {
    expect(getRewardPolicy('perk_machine')).toMatchObject({
      rewardClass: REWARD_CLASS.FIXED,
      multiplierEligible: false,
    });
  });

  it('classifies deal_purchase as earning', () => {
    expect(getRewardPolicy('deal_purchase')).toMatchObject({
      rewardClass: REWARD_CLASS.EARNING,
      multiplierEligible: true,
    });
  });
});

describe('1 — Perk Machine fixed payout', () => {
  it('100 Savvy @ 2.7× effective → 100', () => {
    const u = boostedUser();
    const payout = resolveAuthoritativeSavvyPayout(u, 100, 'perk_machine');
    expect(payout.finalAmount).toBe(100);
    expect(payout.appliedMultiplier).toBe(1);
    expect(payout.multiplierEligible).toBe(false);
  });
});

describe('2 — Feature Voting fixed payout', () => {
  it('15 Savvy @ 3× effective → 15', () => {
    const u = user({ powerMultiplierBonus: 2, subscription: { tier: 'pro' } });
    const payout = resolveAuthoritativeSavvyPayout(u, 15, 'feature_vote_reward');
    expect(payout.finalAmount).toBe(15);
    expect(payout.appliedMultiplier).toBe(1);
  });
});

describe('3 — Login Streak fixed payout', () => {
  it('20 Savvy @ 2× effective → 20', () => {
    const u = doubleUser();
    const payout = resolveAuthoritativeSavvyPayout(u, 20, 'daily_streak');
    expect(payout.finalAmount).toBe(20);
    expect(payout.appliedMultiplier).toBe(1);
  });
});

describe('4 — Battle Pass fixed payout', () => {
  it('500 Savvy @ 3× effective → 500', () => {
    const u = user({ powerMultiplierBonus: 2, subscription: { tier: 'pro' } });
    const payout = resolveAuthoritativeSavvyPayout(u, 500, 'battle_pass');
    expect(payout.finalAmount).toBe(500);
    expect(payout.appliedMultiplier).toBe(1);
  });
});

describe('5 — Deal Purchase earning payout', () => {
  it('200 Savvy @ 2× effective → 400', () => {
    const u = doubleUser();
    expect(resolveSavvyMultiplierState(u).effectiveMultiplier).toBe(2);
    const payout = resolveAuthoritativeSavvyPayout(u, 200, 'deal_purchase');
    expect(payout.multiplierEligible).toBe(true);
    expect(payout.finalAmount).toBe(400);
    expect(payout.appliedMultiplier).toBe(2);
  });
});

describe('6 — Auction earning payout', () => {
  it('150 Savvy @ 1.5× effective → 225', () => {
    const u = user({
      powerMultiplier: 1.5,
      powerMultiplierBonus: 0,
      subscription: { tier: 'free' },
      membershipTier: 'free',
    });
    const payout = resolveAuthoritativeSavvyPayout(u, 150, 'auction_win');
    expect(payout.multiplierEligible).toBe(true);
    expect(payout.finalAmount).toBe(225);
  });
});

describe('7 — Scout Flight earning payout', () => {
  it('100 Savvy @ 2× effective → 200', () => {
    const u = doubleUser();
    const payout = resolveAuthoritativeSavvyPayout(u, 100, 'scout_flight_tournament');
    expect(payout.multiplierEligible).toBe(true);
    expect(payout.finalAmount).toBe(200);
  });
});

describe('8 — Contract fixed payout', () => {
  it('300 Savvy @ 2× effective → 300 when not earning-eligible', () => {
    const u = doubleUser();
    const payout = resolveAuthoritativeSavvyPayout(u, 300, 'contract_reward');
    expect(payout.finalAmount).toBe(300);
    expect(payout.appliedMultiplier).toBe(1);
  });
});

describe('9 — Contract earning-eligible payout', () => {
  it('300 Savvy @ 2× effective → 600 when explicitly marked earning', () => {
    const u = doubleUser();
    const payout = resolveAuthoritativeSavvyPayout(u, 300, 'contract_reward', {
      multiplierEligible: true,
    });
    expect(payout.multiplierEligible).toBe(true);
    expect(payout.finalAmount).toBe(600);
  });
});

describe('10 — Subscription builds multiplier but fixed sources stay flat', () => {
  const proUser = () =>
    user({
      powerMultiplier: 1,
      powerMultiplierBonus: 0,
      subscription: { tier: 'pro' },
      membershipTier: 'pro',
    });

  it('Pro bonus increases deal purchase earnings', () => {
    const u = proUser();
    const deal = resolveAuthoritativeSavvyPayout(u, 100, 'deal_purchase');
    const free = resolveAuthoritativeSavvyPayout(
      user({
        subscription: { tier: 'free' },
        membershipTier: 'free',
        powerMultiplierBonus: 0,
        powerMultiplier: 1,
      }),
      100,
      'deal_purchase'
    );
    expect(deal.finalAmount).toBeGreaterThan(free.finalAmount);
    expect(deal.multiplierEligible).toBe(true);
    expect(deal.finalAmount).toBe(135);
    expect(free.finalAmount).toBe(100);
  });

  it('Pro bonus does not inflate feature vote fixed payout', () => {
    const u = proUser();
    const vote = resolveAuthoritativeSavvyPayout(u, 15, 'feature_vote_reward');
    expect(vote.finalAmount).toBe(15);
    expect(vote.appliedMultiplier).toBe(1);
  });

  it('Pro bonus does not inflate perk machine fixed payout', () => {
    const u = proUser();
    const spin = resolveAuthoritativeSavvyPayout(u, 100, 'perk_machine');
    expect(spin.finalAmount).toBe(100);
    expect(spin.appliedMultiplier).toBe(1);
  });
});

describe('grantSavvyReward applies policy server-side', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('ignores client multiplier hints for fixed rewards', async () => {
    jest.mock('../services/savvyBalanceService', () => ({
      creditSavvy: jest.fn(async () => ({
        granted: true,
        duplicate: false,
        newBalance: 115,
        balanceBefore: 100,
        balanceAfter: 115,
        transactionId: 'tx-1',
      })),
      debitSavvy: jest.fn(),
    }));

    const { grantSavvyReward: grant } = require('../services/savvyRewardService');
    const u = boostedUser();
    const result = await grant(u, {
      rewardType: 'feature_vote_reward',
      amount: 15,
      baseAmount: 15,
      idempotencyKey: 'test-vote',
      meta: { multiplierEligible: true, rewardClass: 'earning' },
    });

    const { creditSavvy } = require('../services/savvyBalanceService');
    expect(creditSavvy).toHaveBeenCalledWith(
      u,
      expect.objectContaining({
        amount: 15,
        meta: expect.objectContaining({
          multiplierEligible: false,
          appliedMultiplier: 1,
          finalAmount: 15,
        }),
      })
    );
    expect(result.amount).toBe(15);
  });
});
