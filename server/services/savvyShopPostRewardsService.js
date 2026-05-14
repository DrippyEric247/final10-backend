/**
 * Savvy Shop post rewards — posting + throttled engagement (simple, idempotent milestones).
 */

const crypto = require('crypto');
const SavvyShopPost = require('../models/SavvyShopPost');
const SavvyShopPostEngagementLog = require('../models/SavvyShopPostEngagementLog');
const { awardCreatorPoints } = require('./savvyCreatorRewardsService');

const POST_CREATE_PTS = 4;

const PTS = {
  post_views_25: 2,
  post_views_120: 5,
  post_likes_5: 3,
  post_likes_20: 6,
  post_saves_3: 4,
  post_saves_12: 8,
  post_shop_click: 2,
};

function fpHashFromRequest(req, bodyFp) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    '';
  const ua = req.headers['user-agent'] || '';
  const extra = bodyFp ? String(bodyFp).slice(0, 64) : '';
  return crypto.createHash('sha256').update(`${ip}|${ua}|${extra}`).digest('hex').slice(0, 48);
}

function hasMilestone(post, key) {
  return (post.milestonesGranted || []).includes(key);
}

async function pushMilestone(postId, key) {
  await SavvyShopPost.updateOne(
    { _id: postId, milestonesGranted: { $ne: key } },
    { $addToSet: { milestonesGranted: key } }
  );
}

async function tryLogPostEngagement(postId, shopId, type, fpHash) {
  if (type === 'shop') {
    const existed = await SavvyShopPostEngagementLog.findOne({ postId, type: 'shop', fpHash }).select('_id').lean();
    if (existed) return { ok: false, reason: 'shop_once' };
    await SavvyShopPostEngagementLog.create({ postId, shopId, type: 'shop', fpHash });
    return { ok: true };
  }
  if (type === 'like' || type === 'save') {
    const existed = await SavvyShopPostEngagementLog.findOne({ postId, type, fpHash }).select('_id').lean();
    if (existed) return { ok: false, reason: 'once_per_fp' };
    await SavvyShopPostEngagementLog.create({ postId, shopId, type, fpHash });
    return { ok: true };
  }
  const gapMs = 20 * 60 * 1000;
  const last = await SavvyShopPostEngagementLog.findOne({ postId, type: 'view', fpHash })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();
  if (last && Date.now() - new Date(last.createdAt).getTime() < gapMs) {
    return { ok: false, reason: 'cooldown' };
  }
  await SavvyShopPostEngagementLog.create({ postId, shopId, type: 'view', fpHash });
  return { ok: true };
}

async function grantIfNew(post, shop, creatorId, key, points, sourcePrefix) {
  if (points <= 0) return { awarded: 0 };
  if (hasMilestone(post, key)) return { awarded: 0 };
  const idem = `creator_post_${creatorId}_${post._id}_${key}`;
  const r = await awardCreatorPoints(creatorId, points, idem, `${sourcePrefix}_${key}`, shop._id);
  if (r.duplicate || r.awarded <= 0) return { awarded: 0 };
  await pushMilestone(post._id, key);
  return { awarded: r.awarded };
}

async function evaluatePostMilestones(post, shop, creatorId) {
  let total = 0;
  const hints = [];
  const v = post.engagement?.viewCount ?? 0;
  const l = post.engagement?.likeCount ?? 0;
  const s = post.engagement?.saveCount ?? 0;

  const steps = [
    { key: 'post_views_25', test: v >= 25, pts: PTS.post_views_25, ui: '🔥 Your post is gaining traction' },
    { key: 'post_views_120', test: v >= 120, pts: PTS.post_views_120, ui: '🔥 Your post is gaining traction' },
    { key: 'post_likes_5', test: l >= 5, pts: PTS.post_likes_5, ui: '💰 This product is earning for you' },
    { key: 'post_likes_20', test: l >= 20, pts: PTS.post_likes_20, ui: '💰 This product is earning for you' },
    { key: 'post_saves_3', test: s >= 3, pts: PTS.post_saves_3, ui: '💰 This product is earning for you' },
    { key: 'post_saves_12', test: s >= 12, pts: PTS.post_saves_12, ui: '💰 This product is earning for you' },
  ];

  let cur = { ...post };
  for (const step of steps) {
    if (!step.test) continue;
    const r = await grantIfNew(cur, shop, creatorId, step.key, step.pts, 'savvy_creator_post_eng');
    if (r.awarded > 0) {
      total += r.awarded;
      hints.push(step.ui);
    }
    const fresh = await SavvyShopPost.findById(post._id).lean();
    Object.assign(cur, fresh);
  }
  return { totalAwarded: total, hints };
}

async function processPostEngagement(req, shop, post, body) {
  const type = String(body?.type || '').toLowerCase();
  if (!['view', 'like', 'save', 'shop'].includes(type)) {
    return { ok: false, message: 'type must be view, like, save, or shop' };
  }
  const fpHash = fpHashFromRequest(req, body?.fp);

  if (type === 'shop') {
    const log = await tryLogPostEngagement(post._id, shop._id, 'shop', fpHash);
    if (!log.ok) {
      return {
        ok: true,
        counted: false,
        reason: log.reason || 'throttled',
        engagement: post.engagement,
        rewards: 0,
        hints: [],
      };
    }
    const creatorId = String(shop.owner);
    const idem = `creator_post_shop_${creatorId}_${post._id}_${fpHash}`;
    const r = await awardCreatorPoints(creatorId, PTS.post_shop_click, idem, 'savvy_creator_post_shop', shop._id);
    const fresh = await SavvyShopPost.findById(post._id).lean();
    return {
      ok: true,
      counted: true,
      engagement: fresh.engagement,
      rewards: r.awarded,
      hints: r.awarded > 0 ? ['💰 This product is earning for you'] : [],
    };
  }

  const log = await tryLogPostEngagement(post._id, shop._id, type, fpHash);
  if (!log.ok) {
    return {
      ok: true,
      counted: false,
      reason: log.reason || 'throttled',
      engagement: post.engagement,
      rewards: 0,
      hints: [],
    };
  }

  const inc = {};
  if (type === 'view') inc['engagement.viewCount'] = 1;
  if (type === 'like') inc['engagement.likeCount'] = 1;
  if (type === 'save') inc['engagement.saveCount'] = 1;

  const updated = await SavvyShopPost.findOneAndUpdate({ _id: post._id }, { $inc: inc }, { new: true }).lean();
  const creatorId = String(shop.owner);
  const eng = await evaluatePostMilestones(updated, shop, creatorId);
  const fresh = await SavvyShopPost.findById(post._id).lean();
  return {
    ok: true,
    counted: true,
    engagement: fresh.engagement,
    rewards: eng.totalAwarded,
    hints: [...new Set(eng.hints)],
  };
}

async function awardPostCreation(creatorId, postId, shopId) {
  const idem = `savvy_creator_shop_post_${creatorId}_${postId}`;
  return awardCreatorPoints(creatorId, POST_CREATE_PTS, idem, 'savvy_creator_shop_post', shopId);
}

module.exports = {
  POST_CREATE_PTS,
  fpHashFromRequest,
  processPostEngagement,
  awardPostCreation,
};
