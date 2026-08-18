/**
 * Wave 6 closure — deal dedupe, auction bid canonical path, normalization safety.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const SavvyTransaction = require('../models/SavvyTransaction');
const SavvyRewardLog = require('../models/SavvyRewardLog');
const DealRewardState = require('../models/DealRewardState');
const SavvyPoint = require('../models/SavvyPoint');
const {
  confirmVerifiedDealPurchase,
  estimateDealReward,
} = require('../services/dealRewardService');
const { grantSavvyReward, debitSavvy } = require('../services/savvyRewardService');
const { resolveSavvyBalance } = require('../lib/dataAuthority');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describe('Wave 6 closure — unit', () => {
  it('pointsBalance mirror writes are opt-in only', () => {
    expect(process.env.SAVVY_MIRROR_POINTS_BALANCE).not.toBe('1');
  });

  it('normalize-user-data defaults to dry-run', () => {
    const scriptPath = require('path').join(__dirname, '../scripts/normalize-user-data.js');
    const src = require('fs').readFileSync(scriptPath, 'utf8');
    expect(src).toMatch(/dryRun:\s*true/);
    expect(src).toMatch(/--apply/);
  });

  it('SavvyPoint awardPoints no longer mutates User.points directly', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../models/SavvyPoint.js'), 'utf8');
    expect(src).toMatch(/grantSavvyReward/);
    expect(src).not.toMatch(/\$inc:\s*\{\s*points/);
    expect(src).not.toMatch(/user\.points\s*[<>=]/);
  });
});

describeReal('Wave 6 closure — deal purchase idempotency (Mongo)', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;
  const listingId = `listing_${suffix}`;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `w6_${suffix}`,
      email: `w6_${suffix}@test.local`,
      savvyPoints: 0,
      pointsBalance: 0,
      points: 0,
      subscription: { tier: 'free' },
      membershipTier: 'free',
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI || !user?._id) return;
    await SavvyTransaction.deleteMany({ userId: user._id });
    await SavvyRewardLog.deleteMany({ userId: user._id });
    await DealRewardState.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    await mongoose.disconnect();
  }, 30000);

  beforeEach(async () => {
    await SavvyTransaction.deleteMany({ userId: user._id });
    await SavvyRewardLog.deleteMany({ userId: user._id });
    await DealRewardState.deleteOne({ userId: user._id, listingId });
  });

  it('confirmVerifiedDealPurchase is idempotent via SavvyTransaction', async () => {
    await DealRewardState.create({
      userId: user._id,
      listingId,
      status: 'pending',
      baseSavvy: 80,
      totalSavvy: 80,
    });

    const listing = { listingId, trustScore: 90, estimatedPointsEarned: 80 };
    const first = await confirmVerifiedDealPurchase(user, { listingId, listing });
    expect(first.granted).toBe(true);
    expect(first.amount).toBeGreaterThan(0);

    const txCount = await SavvyTransaction.countDocuments({
      idempotencyKey: `deal_purchase:${user._id}:${listingId}`,
      status: 'completed',
    });
    expect(txCount).toBe(1);

    const second = await confirmVerifiedDealPurchase(user, { listingId, listing });
    expect(second.alreadyClaimed || second.duplicate).toBeTruthy();

    const fresh = await User.findById(user._id);
    const txSum = await SavvyTransaction.aggregate([
      { $match: { userId: user._id, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    expect(fresh.savvyPoints).toBe(Math.round(Number(txSum[0]?.total) || 0));
  });

  it('concurrent confirm requests cannot double-pay', async () => {
    await DealRewardState.create({
      userId: user._id,
      listingId,
      status: 'pending',
      baseSavvy: 60,
      totalSavvy: 60,
    });

    const listing = { listingId, trustScore: 90, estimatedPointsEarned: 60 };
    const results = await Promise.allSettled([
      confirmVerifiedDealPurchase(user, { listingId, listing }),
      confirmVerifiedDealPurchase(user, { listingId, listing }),
      confirmVerifiedDealPurchase(user, { listingId, listing }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const grantedCount = fulfilled.filter((r) => r.granted).length;
    expect(grantedCount).toBe(1);

    const txCount = await SavvyTransaction.countDocuments({
      idempotencyKey: `deal_purchase:${user._id}:${listingId}`,
      status: 'completed',
    });
    expect(txCount).toBe(1);
  });

  it('readRewardState prefers SavvyTransaction over legacy log', async () => {
    const key = `deal_purchase:${user._id}:${listingId}`;
    await SavvyTransaction.create({
      userId: user._id,
      source: 'deal_purchase',
      amount: 50,
      idempotencyKey: key,
      status: 'completed',
      balanceBefore: 0,
      balanceAfter: 50,
    });

    const est = await estimateDealReward(user, { listingId, trustScore: 90, estimatedPointsEarned: 60 });
    expect(est.state).toBe('claimed');
  });
});

describeReal('Wave 6 closure — auction bid canonical debit (Mongo)', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `w6bid_${suffix}`,
      email: `w6bid_${suffix}@test.local`,
      savvyPoints: 100,
      pointsBalance: 100,
      points: 0,
      subscription: { tier: 'free' },
      membershipTier: 'free',
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI || !user?._id) return;
    await SavvyTransaction.deleteMany({ userId: user._id });
    await SavvyPoint.deleteMany({ user_id: user._id });
    await User.deleteOne({ _id: user._id });
    await mongoose.disconnect();
  }, 30000);

  it('auction bid fee uses debitSavvy without SavvyPoint.redeemPoints', async () => {
    const bidKey = `auction-test:${suffix}`;
    const beforePoints = await SavvyPoint.countDocuments({ user_id: user._id, type: 'redemption' });

    await grantSavvyReward(user, {
      rewardType: 'auction_bid',
      amount: 5,
      baseAmount: 5,
      idempotencyKey: `auction_bid_reward:${bidKey}`,
      note: 'Bid reward test',
    });

    await debitSavvy(user, {
      amount: 10,
      source: 'auction_bid_fee',
      idempotencyKey: `auction_bid_fee:${bidKey}`,
      meta: { feeType: 'free_tier_bid' },
    });

    const afterPoints = await SavvyPoint.countDocuments({ user_id: user._id, type: 'redemption' });
    expect(afterPoints).toBe(beforePoints);

    const fresh = await User.findById(user._id);
    expect(resolveSavvyBalance(fresh)).toBe(95);
    expect(fresh.points).toBe(0);
  });
});
