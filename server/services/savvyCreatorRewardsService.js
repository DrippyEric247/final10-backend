/**
 * Savvy Creator Rewards — shop products, content, engagement, sales (V1).
 * Anti-spam: throttled engagement logs, milestone idempotency, daily Savvy cap (free tier).
 */

const crypto = require('crypto');
const User = require('../models/User');
const SavvyShop = require('../models/SavvyShop');
const SavvyShopProduct = require('../models/SavvyShopProduct');
const SavvyShopEngagementLog = require('../models/SavvyShopEngagementLog');
const PointsLedger = require('../models/PointsLedger');
const { getCreatorMonetizationProfile } = require('./creatorEliteAccessService');

/** @deprecated use creatorEliteAccessService caps — kept for exports */
const CREATOR_SAVVY_DAILY_CAP = 180;

const PTS = {
  add_product: 5,
  content: 10,
  sale: 50,
  high_flip: 25,
  viral: 100,
  hashtag_hit: 5,
  views_100: 4,
  views_500: 8,
  views_2000: 12,
  clicks_50: 4,
  clicks_200: 8,
  saves_10: 6,
  saves_50: 12,
};

const TRACKED_HASHTAGS = new Set(['savvyfinds', 'savvyflip', 'savvyshop']);

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

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

/** dailyCap `null` = unlimited (Elite) */
async function applyCreatorDailyCap(userDoc, pointsToAdd, dailyCap) {
  if (dailyCap == null) {
    return { award: Math.max(0, Math.round(pointsToAdd)), capped: 0 };
  }
  const want = Math.max(0, Math.round(pointsToAdd));
  const day = utcDayKey();
  if (userDoc.creatorRewardsDay !== day) {
    userDoc.creatorRewardsDay = day;
    userDoc.creatorRewardsPointsToday = 0;
  }
  const used = Number(userDoc.creatorRewardsPointsToday) || 0;
  const room = Math.max(0, dailyCap - used);
  const award = Math.min(want, room);
  const capped = want - award;
  userDoc.creatorRewardsPointsToday = used + award;
  return { award, capped };
}

/**
 * @returns {{ awarded: number, capped: number, duplicate?: boolean }}
 */
async function awardCreatorPoints(userId, amount, idempotencyKey, source, shopId) {
  if (amount <= 0) return { awarded: 0, capped: 0 };
  const profile = await getCreatorMonetizationProfile(userId);
  const user = await User.findById(userId);
  if (!user) return { awarded: 0, capped: 0 };

  const { award, capped } = await applyCreatorDailyCap(user, amount, profile.dailySavvyCap);
  if (award <= 0) {
    return { awarded: 0, capped: capped || amount, duplicate: false };
  }

  user.savvyPoints = Number(user.savvyPoints || 0) + award;
  await user.save();
  if (typeof user.bumpWeeklyStat === 'function') {
    await user.bumpWeeklyStat('savvyEarned', award);
  }

  try {
    await PointsLedger.create({
      userId: user._id,
      type: 'earn',
      amount: award,
      source,
      refId: shopId ? String(shopId) : '',
      idempotencyKey,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return { awarded: 0, capped: 0, duplicate: true };
    }
    throw err;
  }

  if (shopId) {
    await SavvyShop.updateOne(
      { _id: shopId },
      { $inc: { totalShopSavvyEarned: award } }
    );
  }

  return { awarded: award, capped };
}

function hasMilestone(product, key) {
  const m = product.milestonesGranted || [];
  return m.includes(key);
}

async function pushMilestone(productId, key) {
  await SavvyShopProduct.updateOne(
    { _id: productId, milestonesGranted: { $ne: key } },
    { $addToSet: { milestonesGranted: key } }
  );
}

function contentMeetsQualityBar(whyBuy, hashtags) {
  const w = String(whyBuy || '').trim();
  const h = Array.isArray(hashtags) ? hashtags.length : 0;
  return w.length >= 140 || (w.length >= 80 && h >= 2);
}

/**
 * Throttle engagement increments (smart decisions, not raw spam).
 */
async function tryLogEngagement(productId, shopId, type, fpHash, campaignTag = '') {
  if (type === 'save') {
    const existed = await SavvyShopEngagementLog.findOne({
      productId,
      type: 'save',
      fpHash,
    })
      .select('_id')
      .lean();
    if (existed) return { ok: false, reason: 'save_once' };
    await SavvyShopEngagementLog.create({
      productId,
      shopId,
      type: 'save',
      fpHash,
      campaignTag: campaignTag || '',
    });
    return { ok: true };
  }

  const gapMs = type === 'view' ? 25 * 60 * 1000 : 90 * 1000;
  const last = await SavvyShopEngagementLog.findOne({ productId, type, fpHash })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();
  if (last && Date.now() - new Date(last.createdAt).getTime() < gapMs) {
    return { ok: false, reason: 'cooldown' };
  }
  await SavvyShopEngagementLog.create({
    productId,
    shopId,
    type,
    fpHash,
    campaignTag: campaignTag || '',
  });
  return { ok: true };
}

async function grantIfNew(product, shop, creatorId, key, points, sourcePrefix) {
  if (points <= 0) return { awarded: 0, hint: null };
  if (hasMilestone(product, key)) return { awarded: 0, hint: null };
  const idem = `creator_shop_${creatorId}_${product._id}_${key}`;
  const r = await awardCreatorPoints(creatorId, points, idem, `${sourcePrefix}_${key}`, shop._id);
  if (r.duplicate || r.awarded <= 0) return { awarded: 0, hint: null };
  await pushMilestone(product._id, key);
  return { awarded: r.awarded, hint: key };
}

async function evaluateEngagementMilestones(product, shop, creatorId, profile) {
  const prof = profile || (await getCreatorMonetizationProfile(creatorId));
  const hints = [];
  let total = 0;
  const v = product.engagement?.viewCount ?? 0;
  const c = product.engagement?.clickCount ?? 0;
  const s = product.engagement?.saveCount ?? 0;

  const steps = [
    { key: 'views_100', test: v >= 100, pts: PTS.views_100, ui: '🔥 Your post is gaining traction' },
    { key: 'views_500', test: v >= 500, pts: PTS.views_500, ui: '🔥 Your post is gaining traction' },
    { key: 'views_2000', test: v >= 2000, pts: PTS.views_2000, ui: '🔥 Your post is gaining traction' },
    { key: 'clicks_50', test: c >= 50, pts: PTS.clicks_50, ui: '💰 This product is earning for you' },
    { key: 'clicks_200', test: c >= 200, pts: PTS.clicks_200, ui: '💰 This product is earning for you' },
    { key: 'saves_10', test: s >= 10, pts: PTS.saves_10, ui: '💰 This product is earning for you' },
    { key: 'saves_50', test: s >= 50, pts: PTS.saves_50, ui: '💰 This product is earning for you' },
  ];

  for (const step of steps) {
    if (!step.test) continue;
    const r = await grantIfNew(product, shop, creatorId, step.key, step.pts, 'savvy_creator_engagement');
    if (r.awarded > 0) {
      total += r.awarded;
      hints.push(step.ui);
    }
    const fresh = await SavvyShopProduct.findById(product._id).lean();
    Object.assign(product, fresh);
  }

  const latest = await SavvyShopProduct.findById(product._id).lean();
  const vv = latest.engagement?.viewCount ?? 0;
  const cc = latest.engagement?.clickCount ?? 0;
  if (
    prof.canViralBonus &&
    vv >= 450 &&
    cc >= 45 &&
    !hasMilestone(latest, 'viral_boost')
  ) {
    const r = await grantIfNew(latest, shop, creatorId, 'viral_boost', PTS.viral, 'savvy_creator_viral');
    if (r.awarded > 0) {
      total += r.awarded;
      hints.push('🔥 Your post is gaining traction');
    }
  }

  return { totalAwarded: total, hints };
}

async function maybeGrantContentBonus(product, shop, creatorId) {
  if (hasMilestone(product, 'content_v1')) return { awarded: 0, hints: [] };
  if (!contentMeetsQualityBar(product.whyBuy, product.hashtags)) {
    return { awarded: 0, hints: [] };
  }
  const r = await grantIfNew(product, shop, creatorId, 'content_v1', PTS.content, 'savvy_creator_content');
  if (r.awarded > 0) {
    return { awarded: r.awarded, hints: ['💰 This product is earning for you'] };
  }
  return { awarded: 0, hints: [] };
}

async function maybeGrantHighFlipBonus(product, shop, creatorId, profile = null) {
  const prof = profile || (await getCreatorMonetizationProfile(creatorId));
  if (!prof.canHighFlipBonus) return { awarded: 0, hints: [] };
  const fs = Number(product.flipScore);
  if (!Number.isFinite(fs) || fs < 8.0) return { awarded: 0, hints: [] };
  if (hasMilestone(product, 'high_flip_8')) return { awarded: 0, hints: [] };
  const r = await grantIfNew(product, shop, creatorId, 'high_flip_8', PTS.high_flip, 'savvy_creator_high_flip');
  if (r.awarded > 0) {
    return { awarded: r.awarded, hints: ['💰 This product is earning for you'] };
  }
  return { awarded: 0, hints: [] };
}

async function maybeGrantHashtagBonus(product, shop, creatorId, campaignTag, fpHash, profile = null) {
  const prof = profile || (await getCreatorMonetizationProfile(creatorId));
  if (!prof.canHashtagBonus) return { awarded: 0, hints: [] };
  const tag = String(campaignTag || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '');
  if (!TRACKED_HASHTAGS.has(tag)) return { awarded: 0, hints: [] };
  const tagsOnProduct = (product.hashtags || []).map((t) => String(t).toLowerCase());
  if (!tagsOnProduct.includes(tag)) {
    return { awarded: 0, hints: [] };
  }
  const day = utcDayKey();
  const idem = `creator_ht_${creatorId}_${product._id}_${tag}_${fpHash}_${day}`;
  const pts = Math.round(PTS.hashtag_hit * (Number(prof.hashtagSavvyMultiplier) || 1));
  const r = await awardCreatorPoints(creatorId, pts, idem, 'savvy_creator_hashtag', shop._id);
  if (r.awarded > 0) {
    return { awarded: r.awarded, hints: ['💰 This product is earning for you'] };
  }
  return { awarded: 0, hints: [] };
}

async function processEngagement(req, shop, product, body) {
  const type = String(body?.type || '').toLowerCase();
  if (!['view', 'click', 'save'].includes(type)) {
    return { ok: false, message: 'type must be view, click, or save' };
  }
  const fpHash = fpHashFromRequest(req, body?.fp);
  const campaignTag = String(body?.campaignHashtag || body?.camp || '').trim();

  const log = await tryLogEngagement(product._id, shop._id, type, fpHash, campaignTag);
  if (!log.ok) {
    return {
      ok: true,
      counted: false,
      reason: log.reason || 'throttled',
      engagement: product.engagement,
      rewards: 0,
      hints: [],
    };
  }

  const inc = {};
  if (type === 'view') inc['engagement.viewCount'] = 1;
  if (type === 'click') inc['engagement.clickCount'] = 1;
  if (type === 'save') inc['engagement.saveCount'] = 1;

  const updated = await SavvyShopProduct.findOneAndUpdate(
    { _id: product._id },
    { $inc: inc },
    { new: true }
  ).lean();

  const creatorId = String(shop.owner);
  const profile = await getCreatorMonetizationProfile(creatorId);
  let hints = [];
  let rewardTotal = 0;

  const eng = await evaluateEngagementMilestones(updated, shop, creatorId, profile);
  rewardTotal += eng.totalAwarded;
  hints = hints.concat(eng.hints);

  const ht = await maybeGrantHashtagBonus(updated, shop, creatorId, campaignTag, fpHash, profile);
  rewardTotal += ht.awarded;
  hints = hints.concat(ht.hints);

  const fresh = await SavvyShopProduct.findById(product._id).lean();
  return {
    ok: true,
    counted: true,
    engagement: fresh.engagement,
    rewards: rewardTotal,
    hints: [...new Set(hints)],
  };
}

async function processReportSale(shop, product) {
  const creatorId = String(shop.owner);
  const profile = await getCreatorMonetizationProfile(creatorId);
  if (!profile.canEarnSaleSavvy) {
    return {
      awarded: 0,
      hints: [profile.copy.elitePayoutTeaser, profile.copy.elitePayoutUnlock],
      locked: true,
      eliteRequired: true,
    };
  }
  const r = await grantIfNew(product, shop, creatorId, 'sale_v1', PTS.sale, 'savvy_creator_sale');
  const hints = [];
  if (r.awarded > 0) hints.push('💰 This product is earning for you');
  return { awarded: r.awarded, hints, locked: false, eliteRequired: false };
}

module.exports = {
  PTS,
  TRACKED_HASHTAGS,
  CREATOR_SAVVY_DAILY_CAP,
  fpHashFromRequest,
  awardCreatorPoints,
  contentMeetsQualityBar,
  maybeGrantContentBonus,
  maybeGrantHighFlipBonus,
  processEngagement,
  processReportSale,
};
