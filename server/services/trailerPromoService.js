/**
 * Hidden trailer promo redemption — atomic Savvy + calling card + supply drop grants.
 */
const User = require('../models/User');
const TrailerPromoRedemption = require('../models/TrailerPromoRedemption');
const { creditSavvy } = require('./savvyBalanceService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const { createSupplyDrop } = require('./supplyDropService');
const { auditFireAndForget, clientIp } = require('./securityAuditService');
const {
  getTrailerPromoCodeDef,
  normalizeTrailerPromoCode,
  TRAILER_PROMO_CODES,
  listActiveTrailerPromoCodes,
} = require('../config/trailerPromoCodes');

function isTrailerPromoCode(rawCode) {
  const upper = normalizeTrailerPromoCode(rawCode);
  return Boolean(upper && TRAILER_PROMO_CODES[upper]);
}

async function countGlobalRedemptions(code) {
  return TrailerPromoRedemption.countDocuments({ code: normalizeTrailerPromoCode(code) });
}

function buildRewardLines(def, rewards) {
  const lines = [];
  if (rewards.savvy > 0) lines.push(`+${rewards.savvy} Savvy`);
  if (rewards.supplyDrop) lines.push('+1 Beta Supply Drop');
  if (rewards.callingCard) lines.push('+Beta Hunter Calling Card');
  return lines;
}

/**
 * @returns {Promise<null|object>} null if not a trailer promo code
 */
async function redeemTrailerPromoCode(userId, rawCode, { req } = {}) {
  const def = getTrailerPromoCodeDef(rawCode);
  if (!def) return null;

  if (def.inactive || def.expired) {
    return {
      ok: false,
      status: 400,
      trailerPromo: true,
      invalid: true,
      message: def.invalidMessage || 'Invalid or expired promo code.',
    };
  }

  if (def.maxRedemptions != null) {
    const globalCount = await countGlobalRedemptions(def.code);
    if (globalCount >= def.maxRedemptions) {
      return {
        ok: false,
        status: 400,
        trailerPromo: true,
        invalid: true,
        message: def.invalidMessage || 'Invalid or expired promo code.',
      };
    }
  }

  const user = await User.findById(userId).select('username email').lean();
  if (!user) {
    return { ok: false, status: 404, trailerPromo: true, message: 'User not found.' };
  }

  const existing = await TrailerPromoRedemption.findOne({ userId, code: def.code }).lean();
  if (existing) {
    return {
      ok: false,
      status: 400,
      trailerPromo: true,
      alreadyRedeemed: true,
      message: def.alreadyRedeemedMessage || "You've already claimed this trailer reward.",
      code: def.code,
    };
  }

  const idempotencyKey = `trailer_promo:${userId}:${def.code}`;
  const ipAddress = clientIp(req);

  let redemption;
  try {
    redemption = await TrailerPromoRedemption.create({
      userId,
      code: def.code,
      username: user.username || null,
      email: user.email || null,
      ipAddress,
      savvyAmount: def.savvyAmount || 0,
      savvyTransactionKey: idempotencyKey,
      callingCardId: def.callingCardId || null,
      meta: { name: def.name, category: def.category, rewardType: def.rewardType },
    });
  } catch (e) {
    if (e?.code === 11000) {
      return {
        ok: false,
        status: 400,
        trailerPromo: true,
        alreadyRedeemed: true,
        message: def.alreadyRedeemedMessage || "You've already claimed this trailer reward.",
        code: def.code,
      };
    }
    throw e;
  }

  const rewards = { savvy: 0, callingCard: null, supplyDrop: null, supplyDropId: null };
  let newBalance;

  try {
    if (def.savvyAmount > 0) {
      const credit = await creditSavvy(userId, {
        amount: def.savvyAmount,
        source: 'trailer_promo',
        idempotencyKey,
        note: `Trailer promo ${def.code} — ${def.name}`,
        meta: { code: def.code, category: def.category },
      });

      if (!credit.granted && !credit.duplicate) {
        throw new Error('SAVVY_CREDIT_FAILED');
      }
      rewards.savvy = credit.granted ? credit.amount : def.savvyAmount;
      newBalance = credit.newBalance;
    }

    if (def.callingCardId && def.callingCardEnabled !== false) {
      const granted = await grantSystemCosmeticUnlock(
        userId,
        def.callingCardId,
        `trailer_promo:${def.code}`
      );
      if (granted) {
        rewards.callingCard = def.callingCardId;
      }
    }

    if (def.supplyDrop) {
      const drop = await createSupplyDrop({
        scope: 'user',
        userId,
        createdBy: userId,
        source: def.supplyDropSource || `trailer_promo:${def.code}`,
        durationMs: def.supplyDropDurationMs,
      });
      rewards.supplyDrop = def.supplyDropLabel || 'Beta Supply Drop';
      rewards.supplyDropId = drop.dropId;
    }

    await TrailerPromoRedemption.updateOne(
      { _id: redemption._id },
      {
        $set: {
          callingCardGranted: Boolean(rewards.callingCard),
          supplyDropId: rewards.supplyDropId,
          rewardsGranted: rewards,
        },
      }
    );

    auditFireAndForget('TRAILER_PROMO_REDEEM', {
      userId,
      req,
      meta: {
        code: def.code,
        username: user.username,
        email: user.email,
        ipAddress,
        rewards,
      },
    });

    const rewardLines = buildRewardLines(def, rewards);

    return {
      ok: true,
      success: true,
      trailerPromo: true,
      message: def.successHeadline,
      code: def.code,
      title: def.successTitle,
      footer: def.successFooter,
      scoutMessage: def.scoutMessage || null,
      ctaLabel: def.ctaLabel || null,
      ctaPath: def.ctaPath || null,
      rewards: {
        savvy: rewards.savvy,
        supplyDrop: rewards.supplyDrop,
        supplyDropId: rewards.supplyDropId,
        callingCard: rewards.callingCard,
        callingCardLabel: rewards.callingCard ? 'Beta Hunter Calling Card' : null,
        lines: rewardLines,
      },
      savvyEarned: rewards.savvy,
      pointsEarned: rewards.savvy,
      newBalance,
      easterEgg: {
        code: def.code,
        name: def.name,
        points: rewards.savvy,
        icon: def.icon,
        category: def.category,
      },
    };
  } catch (err) {
    await TrailerPromoRedemption.deleteOne({ _id: redemption._id });
    console.error('[trailerPromo] redeem rollback', def.code, userId, err);
    return {
      ok: false,
      status: 500,
      trailerPromo: true,
      message: 'Could not grant trailer rewards. Please try again.',
    };
  }
}

async function getTrailerPromoRedemptions({ code, limit = 100 } = {}) {
  const filter = {};
  if (code) filter.code = normalizeTrailerPromoCode(code);

  const rows = await TrailerPromoRedemption.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 500))
    .lean();

  return rows.map((r) => ({
    id: String(r._id),
    userId: String(r.userId),
    username: r.username,
    email: r.email,
    code: r.code,
    ipAddress: r.ipAddress,
    savvyAmount: r.savvyAmount,
    callingCardId: r.callingCardId,
    callingCardGranted: r.callingCardGranted,
    supplyDropId: r.supplyDropId,
    rewardsGranted: r.rewardsGranted,
    redeemedAt: r.createdAt,
  }));
}

async function getTrailerPromoStats() {
  const rows = await TrailerPromoRedemption.find({}).lean();
  const byCode = {};

  for (const r of rows) {
    if (!byCode[r.code]) {
      const def = TRAILER_PROMO_CODES[r.code] || {};
      byCode[r.code] = {
        code: r.code,
        name: def.name || r.code,
        redemptions: 0,
        uniqueUsers: new Set(),
        totalSavvyAwarded: 0,
        callingCardsGranted: 0,
        supplyDropsGranted: 0,
      };
    }
    const bucket = byCode[r.code];
    bucket.redemptions += 1;
    bucket.uniqueUsers.add(String(r.userId));
    bucket.totalSavvyAwarded += r.savvyAmount || 0;
    if (r.callingCardGranted) bucket.callingCardsGranted += 1;
    if (r.supplyDropId) bucket.supplyDropsGranted += 1;
  }

  const codeStats = Object.values(byCode).map((b) => ({
    ...b,
    uniqueUsers: b.uniqueUsers.size,
    uniqueUsersSet: undefined,
  }));

  return {
    totalRedemptions: rows.length,
    uniqueUsers: new Set(rows.map((r) => String(r.userId))).size,
    totalSavvyAwarded: rows.reduce((s, r) => s + (r.savvyAmount || 0), 0),
    activeCodes: listActiveTrailerPromoCodes().length,
    configuredCodes: Object.keys(TRAILER_PROMO_CODES).length,
    codeStats: codeStats.sort((a, b) => b.redemptions - a.redemptions),
  };
}

module.exports = {
  isTrailerPromoCode,
  redeemTrailerPromoCode,
  getTrailerPromoRedemptions,
  getTrailerPromoStats,
  normalizeTrailerPromoCode,
};
