/**
 * Feature Voting Savvy reward tests.
 *
 * Run: cd server && MONGODB_URI=mongodb://127.0.0.1:27017/final10_test npm test -- featureVoteReward.test.js
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const SavvyTransaction = require('../models/SavvyTransaction');
const BetaCommunityVote = require('../models/BetaCommunityVote');
const BetaCommunityConfig = require('../models/BetaCommunityConfig');
const {
  castVote,
  getPublicSnapshot,
  findUnrewardedFeatureVotes,
} = require('../services/betaCommunityFeedbackService');
const {
  FEATURE_VOTE_REWARD_SAVVY,
  FEATURE_VOTE_REWARD_TYPE,
  featureVoteIdempotencyKey,
} = require('../config/featureVoting');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

describe('Feature vote reward config', () => {
  it('uses fixed +15 Savvy (not multiplier-scaled)', () => {
    expect(FEATURE_VOTE_REWARD_SAVVY).toBe(15);
    expect(FEATURE_VOTE_REWARD_TYPE).toBe('feature_vote_reward');
  });
});

describeReal('Feature vote reward integration', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const topicA = 'quick_snipes_improvements';
  const topicB = 'new_events';
  let user;
  let prevBetaMode;

  beforeAll(async () => {
    prevBetaMode = process.env.BETA_MODE;
    process.env.BETA_MODE = 'true';
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `fv_${suffix}`,
      email: `fv_${suffix}@test.local`,
      savvyPoints: 100,
      pointsBalance: 100,
      lifetimePointsEarned: 100,
    });
    await BetaCommunityConfig.deleteMany({ singletonKey: 'default' });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await new Promise((r) => setTimeout(r, 300));
    try {
      if (user?._id) {
        await BetaCommunityVote.deleteMany({ userId: user._id });
        await SavvyTransaction.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await BetaCommunityConfig.deleteMany({ singletonKey: 'default' });
    } finally {
      await mongoose.disconnect();
      if (prevBetaMode === undefined) delete process.env.BETA_MODE;
      else process.env.BETA_MODE = prevBetaMode;
    }
  }, 30000);

  beforeEach(async () => {
    await BetaCommunityVote.deleteMany({ userId: user._id });
    await SavvyTransaction.deleteMany({ userId: user._id });
    await User.updateOne(
      { _id: user._id },
      { $set: { savvyPoints: 100, pointsBalance: 100, lifetimePointsEarned: 100 } }
    );
    user = await User.findById(user._id);
  });

  it('first vote records vote, grants +15 Savvy, returns updated balance', async () => {
    const result = await castVote(user, topicA);
    expect(result.ok).toBe(true);
    expect(result.reward).toMatchObject({
      amount: FEATURE_VOTE_REWARD_SAVVY,
      newBalance: 100 + FEATURE_VOTE_REWARD_SAVVY,
    });
    expect(result.savvyBalance).toBe(115);

    const vote = await BetaCommunityVote.findOne({ userId: user._id, topicId: topicA });
    expect(vote).toBeTruthy();

    const txn = await SavvyTransaction.findOne({
      idempotencyKey: featureVoteIdempotencyKey(user._id, topicA),
      status: 'completed',
    }).lean();
    expect(txn).toBeTruthy();
    expect(txn.amount).toBe(FEATURE_VOTE_REWARD_SAVVY);
    expect(txn.rewardType).toBe(FEATURE_VOTE_REWARD_TYPE);
    expect(txn.meta?.source).toBe('home_feature_voting');
    expect(txn.meta?.topicId).toBe(topicA);

    const refreshed = await User.findById(user._id);
    expect(refreshed.savvyPoints).toBe(115);
  });

  it('second vote on same topic is rejected with no extra Savvy', async () => {
    const first = await castVote(user, topicA);
    expect(first.ok).toBe(true);

    const second = await castVote(user, topicA);
    expect(second.ok).toBe(false);
    expect(second.code).toBe('ALREADY_VOTED');

    const refreshed = await User.findById(user._id);
    expect(refreshed.savvyPoints).toBe(115);

    const txns = await SavvyTransaction.find({
      userId: user._id,
      rewardType: FEATURE_VOTE_REWARD_TYPE,
      status: 'completed',
    });
    expect(txns).toHaveLength(1);
  });

  it('different topic grants another +15 Savvy', async () => {
    await castVote(user, topicA);
    const second = await castVote(user, topicB);
    expect(second.ok).toBe(true);
    expect(second.reward.amount).toBe(FEATURE_VOTE_REWARD_SAVVY);
    expect(second.savvyBalance).toBe(130);

    const refreshed = await User.findById(user._id);
    expect(refreshed.savvyPoints).toBe(130);
  });

  it('retried API with same idempotency grants reward only once', async () => {
    const first = await castVote(user, topicA);
    expect(first.ok).toBe(true);

    const dup = await castVote(user, topicA);
    expect(dup.ok).toBe(false);
    expect(dup.code).toBe('ALREADY_VOTED');

    const txns = await SavvyTransaction.find({
      userId: user._id,
      idempotencyKey: featureVoteIdempotencyKey(user._id, topicA),
    });
    expect(txns).toHaveLength(1);
  });

  it('snapshot persists voted state after refresh', async () => {
    await castVote(user, topicA);
    const snap = await getPublicSnapshot(user._id);
    const topic = snap.topics.find((t) => t.id === topicA);
    expect(topic?.voted).toBe(true);
  });

  it('failed vote on invalid topic does not grant Savvy', async () => {
    const result = await castVote(user, 'not_a_real_topic');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('TOPIC_NOT_FOUND');

    const voteCount = await BetaCommunityVote.countDocuments({ userId: user._id });
    expect(voteCount).toBe(0);

    const refreshed = await User.findById(user._id);
    expect(refreshed.savvyPoints).toBe(100);
  });

  it('findUnrewardedFeatureVotes detects votes missing ledger rows', async () => {
    await BetaCommunityVote.create({ userId: user._id, topicId: topicA });
    const rows = await findUnrewardedFeatureVotes({ limit: 50 });
    expect(rows.some((r) => r.userId === String(user._id) && r.topicId === topicA)).toBe(true);
  });
});
