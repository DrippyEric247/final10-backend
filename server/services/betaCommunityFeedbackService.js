const BetaCommunityConfig = require('../models/BetaCommunityConfig');
const BetaCommunityVote = require('../models/BetaCommunityVote');
const BetaCommunityReview = require('../models/BetaCommunityReview');
const BetaCommunityMembershipFeedback = require('../models/BetaCommunityMembershipFeedback');
const User = require('../models/User');
const { isBetaMode } = require('../config/betaMode');
const { grantSavvyReward } = require('./savvyRewardService');
const { utcDayKey } = require('../config/savvyRewards');

const DEFAULT_TOPICS = [
  { id: 'quick_snipes_improvements', label: 'Quick Snipes Improvements', emoji: '⚡', active: true, sortOrder: 1 },
  { id: 'better_ai_best_moves', label: 'Better AI Best Moves', emoji: '🎯', active: true, sortOrder: 2 },
  { id: 'new_events', label: 'New Events', emoji: '🎉', active: true, sortOrder: 3 },
  { id: 'perk_machine_rewards', label: 'Perk Machine Rewards', emoji: '🎰', active: true, sortOrder: 4 },
  { id: 'savvy_scout_flight', label: 'Savvy Scout Flight Updates', emoji: '✈️', active: true, sortOrder: 5 },
  { id: 'founding_tester_rewards', label: 'Founding Tester Rewards', emoji: '🏅', active: true, sortOrder: 6 },
  { id: 'savvy_shop_integration', label: 'SavvyShop Integration', emoji: '🛍️', active: true, sortOrder: 7 },
  { id: 'savvy_trip_preview', label: 'SavvyTrip Preview', emoji: '🌍', active: true, sortOrder: 8 },
  { id: 'new_calling_cards', label: 'New Calling Cards', emoji: '🎴', active: true, sortOrder: 9 },
  { id: 'profile_customization', label: 'Profile Customization', emoji: '👤', active: true, sortOrder: 10 },
  { id: 'membership_tier_design', label: 'Membership Tier Design', emoji: '🚀', active: true, sortOrder: 11 },
  { id: 'membership_pricing', label: 'Membership Pricing & Value', emoji: '💎', active: true, sortOrder: 12 },
  { id: 'membership_pro_features', label: 'Pro-Exclusive Features', emoji: '👑', active: true, sortOrder: 13 },
];

const DEFAULT_SHIPPED = [
  { id: 'nav_redesign', label: 'Navigation redesigned', shippedAt: new Date('2026-07-04') },
  { id: 'qs_before_auctions', label: 'Quick Snipes moved before Auctions', shippedAt: new Date('2026-07-04') },
  { id: 'best_move_default', label: 'Search defaults to Best Move', shippedAt: new Date('2026-07-03') },
  { id: 'mobile_popups', label: 'Mobile popup improvements', shippedAt: new Date('2026-07-02') },
  { id: 'event_notifications', label: 'Better event notifications', shippedAt: new Date('2026-07-01') },
  { id: 'faster_alerts', label: 'Faster alerts', shippedAt: new Date('2026-06-28') },
];

async function getOrSeedConfig() {
  let doc = await BetaCommunityConfig.findOne({ singletonKey: 'default' });
  if (!doc) {
    doc = await BetaCommunityConfig.create({
      singletonKey: 'default',
      topics: DEFAULT_TOPICS,
      shippedItems: DEFAULT_SHIPPED,
    });
  }
  if (!doc.topics?.length) {
    doc.topics = DEFAULT_TOPICS;
    await doc.save();
  }
  if (!doc.shippedItems?.length) {
    doc.shippedItems = DEFAULT_SHIPPED;
    await doc.save();
  }
  return doc;
}

async function countBetaTesters() {
  return User.countDocuments({
    $or: [
      { isBetaTester: true },
      { foundingTesterAccess: true },
      { betaTester: true },
      { foundingAccess: true },
    ],
  });
}

async function getVoteCounts() {
  const rows = await BetaCommunityVote.aggregate([
    { $group: { _id: '$topicId', count: { $sum: 1 } } },
  ]);
  const map = {};
  rows.forEach((r) => {
    map[r._id] = r.count;
  });
  return map;
}

async function getAverageRating() {
  const rows = await BetaCommunityReview.aggregate([
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = rows[0]?.avg;
  const count = rows[0]?.count || 0;
  return {
    average: count > 0 ? Math.round(avg * 10) / 10 : 0,
    reviewCount: count,
  };
}

async function getPublicSnapshot(userId = null) {
  const config = await getOrSeedConfig();
  const voteCounts = await getVoteCounts();
  const totalVotes = await BetaCommunityVote.countDocuments();
  const totalTesters = await countBetaTesters();
  const { average, reviewCount } = await getAverageRating();

  let userVotes = [];
  let userReviewedToday = false;
  if (userId) {
    userVotes = await BetaCommunityVote.find({ userId }).select('topicId').lean();
    userReviewedToday = Boolean(
      await BetaCommunityReview.findOne({ userId, dayKey: utcDayKey() }).select('_id').lean()
    );
  }

  const topics = (config.topics || [])
    .filter((t) => t.active !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((t) => ({
      id: t.id,
      label: t.label,
      emoji: t.emoji || '✨',
      votes: voteCounts[t.id] || 0,
      voted: userVotes.some((v) => v.topicId === t.id),
    }));

  const shippedItems = [...(config.shippedItems || [])]
    .sort((a, b) => new Date(b.shippedAt) - new Date(a.shippedAt))
    .map((s) => ({ id: s.id, label: s.label, shippedAt: s.shippedAt }));

  return {
    betaMode: isBetaMode(),
    rewards: config.rewards || {},
    scoutLines: config.scoutLines || [],
    topics,
    shippedItems,
    stats: {
      totalBetaTesters: totalTesters,
      votesCast: totalVotes,
      bugsFixed: config.stats?.bugsFixed ?? 0,
      suggestionsImplemented: config.stats?.suggestionsImplemented ?? shippedItems.length,
      averageRating: average,
      reviewCount,
    },
    user: userId
      ? {
          votedTopicIds: userVotes.map((v) => v.topicId),
          reviewedToday: userReviewedToday,
        }
      : null,
  };
}

async function castVote(user, topicId) {
  if (!isBetaMode()) {
    return { ok: false, code: 'BETA_INACTIVE', message: 'Community voting is only available during beta.' };
  }
  const config = await getOrSeedConfig();
  const topic = (config.topics || []).find((t) => t.id === topicId && t.active !== false);
  if (!topic) {
    return { ok: false, code: 'TOPIC_NOT_FOUND', message: 'That feature topic is not available.' };
  }

  const existing = await BetaCommunityVote.findOne({ userId: user._id, topicId });
  if (existing) {
    return { ok: false, code: 'ALREADY_VOTED', message: 'You already voted on this topic.' };
  }

  await BetaCommunityVote.create({ userId: user._id, topicId });

  const voteSavvy = Math.max(0, Math.round(Number(config.rewards?.voteSavvy) || 15));
  let reward = null;
  if (voteSavvy > 0) {
    reward = await grantSavvyReward(user, {
      rewardType: 'beta_community_vote',
      amount: voteSavvy,
      idempotencyKey: `beta_community_vote:${user._id}:${topicId}`,
      note: `Community vote: ${topic.label}`,
      meta: { topicId },
    });
  }

  const snapshot = await getPublicSnapshot(user._id);
  return {
    ok: true,
    reward: reward?.granted
      ? { amount: voteSavvy, newBalance: reward.newBalance }
      : null,
    snapshot,
  };
}

async function submitReview(user, { rating, enjoyed = '', improve = '', reportBug = '' }) {
  if (!isBetaMode()) {
    return { ok: false, code: 'BETA_INACTIVE', message: 'Beta reviews are only available during beta.' };
  }
  const stars = Math.round(Number(rating));
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return { ok: false, code: 'INVALID_RATING', message: 'Please select a 1–5 star rating.' };
  }

  const config = await getOrSeedConfig();
  const dayKey = utcDayKey();
  const existing = await BetaCommunityReview.findOne({ userId: user._id, dayKey });
  if (existing) {
    return { ok: false, code: 'DAILY_LIMIT', message: 'You already shared feedback today. Come back tomorrow!' };
  }

  const reviewSavvy = Math.max(0, Math.round(Number(config.rewards?.reviewSavvy) || 25));
  let reward = null;

  await BetaCommunityReview.create({
    userId: user._id,
    dayKey,
    rating: stars,
    enjoyed: String(enjoyed || '').slice(0, 2000),
    improve: String(improve || '').slice(0, 2000),
    reportBug: String(reportBug || '').slice(0, 2000),
    savvyGranted: reviewSavvy,
  });

  if (reviewSavvy > 0) {
    reward = await grantSavvyReward(user, {
      rewardType: 'beta_community_review',
      amount: reviewSavvy,
      idempotencyKey: `beta_community_review:${user._id}:${dayKey}`,
      note: 'Beta experience review',
      meta: { rating: stars },
    });
  }

  const snapshot = await getPublicSnapshot(user._id);
  return {
    ok: true,
    reward: reward?.granted
      ? { amount: reviewSavvy, newBalance: reward.newBalance }
      : null,
    snapshot,
  };
}

async function adminUpdateConfig(patch = {}) {
  const config = await getOrSeedConfig();
  if (patch.rewards && typeof patch.rewards === 'object') {
    config.rewards = { ...config.rewards?.toObject?.() || config.rewards, ...patch.rewards };
  }
  if (patch.stats && typeof patch.stats === 'object') {
    config.stats = { ...config.stats?.toObject?.() || config.stats, ...patch.stats };
  }
  if (Array.isArray(patch.topics)) {
    config.topics = patch.topics;
  }
  if (Array.isArray(patch.shippedItems)) {
    config.shippedItems = patch.shippedItems.map((s) => ({
      id: s.id || `shipped_${Date.now()}`,
      label: s.label,
      shippedAt: s.shippedAt ? new Date(s.shippedAt) : new Date(),
    }));
    config.stats = config.stats || {};
    config.stats.suggestionsImplemented = config.shippedItems.length;
  }
  if (Array.isArray(patch.scoutLines)) {
    config.scoutLines = patch.scoutLines.filter(Boolean);
  }
  await config.save();
  return getPublicSnapshot();
}

async function adminAddTopic({ id, label, emoji = '✨' }) {
  const config = await getOrSeedConfig();
  const topicId = String(id || label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!topicId || !label) {
    throw new Error('Topic id and label are required');
  }
  if ((config.topics || []).some((t) => t.id === topicId)) {
    throw new Error('Topic id already exists');
  }
  const maxOrder = Math.max(0, ...(config.topics || []).map((t) => t.sortOrder || 0));
  config.topics.push({ id: topicId, label, emoji, active: true, sortOrder: maxOrder + 1 });
  await config.save();
  return getPublicSnapshot();
}

async function submitMembershipFeedback(user, { type = 'suggestion', message = '' } = {}) {
  if (!isBetaMode()) {
    return { ok: false, code: 'BETA_INACTIVE', message: 'Membership feedback is only available during beta.' };
  }
  const text = String(message || '').trim();
  if (text.length < 8) {
    return { ok: false, code: 'TOO_SHORT', message: 'Please share at least a sentence of feedback.' };
  }
  const dayKey = utcDayKey();
  const feedbackType = type === 'vote_intent' ? 'vote_intent' : 'suggestion';

  if (feedbackType === 'suggestion') {
    const todayCount = await BetaCommunityMembershipFeedback.countDocuments({
      userId: user._id,
      type: 'suggestion',
      dayKey,
    });
    if (todayCount >= 5) {
      return { ok: false, code: 'DAILY_LIMIT', message: 'Daily suggestion limit reached. Thanks for all your input!' };
    }
  }

  await BetaCommunityMembershipFeedback.create({
    userId: user._id,
    username: user.username || user.firstName || '',
    type: feedbackType,
    message: text.slice(0, 4000),
    dayKey,
  });

  return { ok: true, message: 'Thanks — the team will review your membership feedback.' };
}

async function listMembershipFeedback({ limit = 50 } = {}) {
  const rows = await BetaCommunityMembershipFeedback.find()
    .sort({ createdAt: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    username: r.username || 'Tester',
    type: r.type,
    message: r.message,
    createdAt: r.createdAt,
  }));
}

module.exports = {
  getOrSeedConfig,
  getPublicSnapshot,
  castVote,
  submitReview,
  submitMembershipFeedback,
  listMembershipFeedback,
  adminUpdateConfig,
  adminAddTopic,
  DEFAULT_TOPICS,
  DEFAULT_SHIPPED,
};
