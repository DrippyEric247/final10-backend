/**
 * Wave 1 blocker regression — ledger consolidation + policy security.
 *
 * Run: cd server && npm test -- economy-wave1-blockers.test.js
 */

jest.mock('../models/SavvyRewardLog', () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock('../services/eventSummaryService', () => ({
  recordSavvyEarnedForActiveEvents: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/savvyBalanceService', () => ({
  creditSavvy: jest.fn(async () => ({
    granted: true,
    duplicate: false,
    newBalance: 115,
    balanceBefore: 100,
    balanceAfter: 115,
    transactionId: 'tx-blocker-1',
  })),
  debitSavvy: jest.fn(),
}));

const { creditSavvy } = require('../services/savvyBalanceService');
const { grantSavvyReward } = require('../services/savvyRewardService');
const { resolveAuthoritativeSavvyPayout } = require('../services/savvyMultiplierService');

function boostedUser() {
  return {
    _id: 'blocker-user',
    subscription: { tier: 'pro' },
    membershipTier: 'pro',
    powerMultiplier: 2,
    powerMultiplierBonus: 0,
    savvyPoints: 100,
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('client spoof cannot inflate fixed rewards', () => {
  it('grantSavvyReward ignores meta.multiplierEligible without contract config', async () => {
    const u = boostedUser();
    const result = await grantSavvyReward(u, {
      rewardType: 'feature_vote_reward',
      amount: 15,
      baseAmount: 15,
      idempotencyKey: 'spoof-vote-1',
      meta: { multiplierEligible: true, rewardClass: 'earning', finalAmount: 999 },
    });

    expect(result.amount).toBe(15);
    expect(creditSavvy).toHaveBeenCalledTimes(1);
    expect(creditSavvy.mock.calls[0][1].amount).toBe(15);
    expect(creditSavvy.mock.calls[0][1].meta.multiplierEligible).toBe(false);
    expect(creditSavvy.mock.calls[0][1].meta.appliedMultiplier).toBe(1);
  });
});

describe('single canonical credit per grant', () => {
  it('calls creditSavvy exactly once for perk machine fixed grant', async () => {
    const u = boostedUser();
    await grantSavvyReward(u, {
      rewardType: 'perk_machine',
      amount: 100,
      baseAmount: 100,
      idempotencyKey: 'perk-spin-1',
    });
    expect(creditSavvy).toHaveBeenCalledTimes(1);
    expect(creditSavvy.mock.calls[0][1].amount).toBe(100);
  });

  it('calls creditSavvy once with multiplied amount for deal purchase', async () => {
    const u = boostedUser();
    await grantSavvyReward(u, {
      rewardType: 'deal_purchase',
      amount: 200,
      baseAmount: 200,
      idempotencyKey: 'deal-1',
    });
    expect(creditSavvy).toHaveBeenCalledTimes(1);
    expect(creditSavvy.mock.calls[0][1].amount).toBe(470);
    expect(creditSavvy.mock.calls[0][1].meta.rewardClass).toBe('earning');
  });
});

describe('transaction metadata shape', () => {
  it('includes policy fields on creditSavvy meta', async () => {
    const u = boostedUser();
    await grantSavvyReward(u, {
      rewardType: 'deal_purchase',
      amount: 100,
      baseAmount: 100,
      idempotencyKey: 'meta-deal-1',
    });
    const meta = creditSavvy.mock.calls[0][1].meta;
    expect(meta).toMatchObject({
      source: 'deal_purchase',
      rewardClass: 'earning',
      multiplierEligible: true,
      baseAmount: 100,
      appliedMultiplier: expect.any(Number),
      finalAmount: expect.any(Number),
    });
    expect(meta.finalAmount).toBe(Math.round(100 * meta.appliedMultiplier));
  });
});

describe('preview equals payout resolver', () => {
  it('resolveAuthoritativeSavvyPayout matches grantSavvyReward amount for deals', async () => {
    const u = boostedUser();
    const preview = resolveAuthoritativeSavvyPayout(u, 200, 'deal_purchase');
    creditSavvy.mockClear();
    const grant = await grantSavvyReward(u, {
      rewardType: 'deal_purchase',
      amount: 200,
      baseAmount: 200,
      idempotencyKey: 'parity-deal-1',
    });
    expect(grant.amount).toBe(preview.finalAmount);
    expect(creditSavvy.mock.calls[0][1].amount).toBe(preview.finalAmount);
  });

  it('fixed preview stays flat even with high effective multiplier', () => {
    const u = boostedUser();
    const preview = resolveAuthoritativeSavvyPayout(u, 15, 'feature_vote_reward');
    expect(preview.finalAmount).toBe(15);
    expect(preview.appliedMultiplier).toBe(1);
  });
});
