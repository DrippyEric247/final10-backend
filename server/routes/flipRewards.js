const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const FlipTrackedListing = require('../models/FlipTrackedListing');
const SavvyFlipRewardLog = require('../models/SavvyFlipRewardLog');
const PointsLedger = require('../models/PointsLedger');
const { getEntitlementByUserId } = require('../services/premiumEntitlementService');
const {
  computeListingBonusAfterFlipScore,
  computeSaleStack,
  passesAntiAbuse,
  applyDailyCap,
  EARLY_CANCEL_WINDOW_MS,
} = require('../services/flipRewardsService');

const router = express.Router();
router.use(auth);

function extractSellerListingId(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/(\d{10,13})/);
  return m ? m[1] : null;
}

async function isPremiumUser(userId) {
  const ent = await getEntitlementByUserId(userId);
  if (!ent) return false;
  const s = String(ent.premiumStatus || '').toLowerCase();
  return s === 'active' || s === 'trialing';
}

async function creditSavvyWithCap(
  userDoc,
  points,
  premium,
  idempotencyKey,
  source,
  refId,
  breakdown,
  flipScoreAtCompletion = null
) {
  const { award, capped } = applyDailyCap(userDoc, points, premium);
  if (award <= 0) {
    return { awarded: 0, capped, ledgerWritten: false };
  }
  userDoc.savvyPoints = Number(userDoc.savvyPoints || 0) + award;
  await userDoc.save();
  if (typeof userDoc.bumpWeeklyStat === 'function') {
    await userDoc.bumpWeeklyStat('savvyEarned', award);
  }
  await PointsLedger.create({
    userId: userDoc._id,
    type: 'earn',
    amount: award,
    source,
    refId: refId || '',
    idempotencyKey,
  }).catch((err) => {
    if (err?.code !== 11000) throw err;
  });
  await SavvyFlipRewardLog.create({
    userId: userDoc._id,
    kind: source === 'flip_listing_bonus' ? 'listing_bonus' : 'sale_stack',
    idempotencyKey,
    points: award,
    sellerListingId: refId || '',
    breakdown: breakdown || null,
    cappedPoints: capped,
    flipScoreAtCompletion:
      flipScoreAtCompletion != null && Number.isFinite(Number(flipScoreAtCompletion))
        ? Number(flipScoreAtCompletion)
        : null,
  }).catch((err) => {
    if (err?.code !== 11000) throw err;
  });
  return { awarded: award, capped, ledgerWritten: true };
}

async function recordFlipRewardStub(
  userId,
  idempotencyKey,
  kind,
  sellerListingId,
  breakdown,
  capped,
  flipScoreAtCompletion = null
) {
  await SavvyFlipRewardLog.create({
    userId,
    kind,
    idempotencyKey,
    points: 0,
    sellerListingId: sellerListingId || '',
    breakdown: breakdown || null,
    cappedPoints: capped || 0,
    flipScoreAtCompletion:
      flipScoreAtCompletion != null && Number.isFinite(Number(flipScoreAtCompletion))
        ? Number(flipScoreAtCompletion)
        : null,
  }).catch((err) => {
    if (err?.code !== 11000) throw err;
  });
}

function bumpFlipGamification(userDoc, flipScoreRaw) {
  const fs = Number(flipScoreRaw);
  if (!Number.isFinite(fs)) return;
  userDoc.flipTotalCompleted = Number(userDoc.flipTotalCompleted || 0) + 1;
  userDoc.flipScoreLifetimeSum = Number(userDoc.flipScoreLifetimeSum || 0) + fs;
  const best = userDoc.flipBestScoreEver;
  if (!Number.isFinite(best) || fs > best) {
    userDoc.flipBestScoreEver = fs;
  }
  const badges = Array.isArray(userDoc.badges) ? [...userDoc.badges] : [];
  if (fs >= 8.5 && !badges.includes('elite_flip')) {
    badges.push('elite_flip');
  }
  userDoc.badges = badges;
}

/**
 * POST /api/flip-rewards/register-listing
 * Register seller's live listing for flip rewards (+ listing bonus once).
 */
router.post('/register-listing', async (req, res) => {
  try {
    const premium = await isPremiumUser(req.user.id);
    const sellerListingId =
      extractSellerListingId(req.body.sellerListingId) ||
      extractSellerListingId(req.body.listingId);
    if (!sellerListingId) {
      return res.status(400).json({ message: 'A numeric listing id (e.g. eBay item id) is required.' });
    }

    const listingType = req.body.listingType === 'custom' ? 'custom' : 'ebay';
    const buyPrice = Math.max(0, Number(req.body.buyPrice) || 0);
    const suggestedMin = Math.max(0, Number(req.body.suggestedSellMin ?? req.body.suggestedMin) || 0);
    const suggestedMax = Math.max(0, Number(req.body.suggestedSellMax ?? req.body.suggestedMax) || 0);
    const predictedDaysToSell = Math.max(1, Math.min(120, Number(req.body.predictedDaysToSell) || 14));
    const flipScore =
      req.body.flipScore != null && Number.isFinite(Number(req.body.flipScore))
        ? clampFlipScore(Number(req.body.flipScore))
        : null;
    const fromAiSuggestion = Boolean(req.body.fromAiSuggestion);
    const dealItemId = String(req.body.dealItemId || '').trim().slice(0, 32);
    let promotedListingId = null;
    if (req.body.promotedListingId && mongoose.Types.ObjectId.isValid(req.body.promotedListingId)) {
      promotedListingId = new mongoose.Types.ObjectId(req.body.promotedListingId);
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const idempotencyKey = `flip_listing_bonus_${user._id}_${sellerListingId}`;
    const existingLog = await SavvyFlipRewardLog.findOne({ idempotencyKey }).lean();

    const prior = await FlipTrackedListing.findOne({
      user: user._id,
      sellerListingId,
    }).lean();
    const preserveClock =
      prior && prior.status === 'open' && String(prior.user) === String(user._id);
    const listedAtValue = preserveClock ? new Date(prior.listedAt) : new Date();

    const track = await FlipTrackedListing.findOneAndUpdate(
      { user: user._id, sellerListingId },
      {
        $set: {
          listingType,
          dealItemId,
          promotedListingId,
          buyPrice,
          suggestedMin,
          suggestedMax,
          predictedDaysToSell,
          flipScore,
          fromAiSuggestion,
          listedAt: listedAtValue,
          status: 'open',
          cancelledEarly: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (existingLog) {
      return res.json({
        success: true,
        alreadyRegistered: true,
        listingBonusAwarded: existingLog.points,
        tracked: track,
      });
    }

    const listingBonus = computeListingBonusAfterFlipScore(fromAiSuggestion, flipScore);
    const { awarded, capped, ledgerWritten } = await creditSavvyWithCap(
      user,
      listingBonus,
      premium,
      idempotencyKey,
      'flip_listing_bonus',
      sellerListingId,
      {
        listingBase: true,
        aiMatch: fromAiSuggestion,
        requested: listingBonus,
        capped,
        flipScore,
      },
      flipScore
    );

    if (!ledgerWritten) {
      await recordFlipRewardStub(
        user._id,
        idempotencyKey,
        'listing_bonus',
        sellerListingId,
        {
          reason: listingBonus <= 0 ? 'flip_score_listing_none' : 'daily_cap',
          requested: listingBonus,
        },
        capped,
        flipScore
      );
    }

    await FlipTrackedListing.updateOne(
      { user: user._id, sellerListingId },
      { $set: { listingBonusApplied: true } }
    );

    return res.status(201).json({
      success: true,
      listingBonusAwarded: awarded,
      dailyCapCapped: capped,
      premium,
      message:
        awarded > 0
          ? '💰 You made a smart move — listing bonus banked as Savvy Points.'
          : 'Daily flip Savvy cap reached — try again tomorrow or upgrade for unlimited.',
    });
  } catch (err) {
    console.error('flip-rewards register-listing', err);
    if (err.code === 11000) {
      return res.status(200).json({ success: true, alreadyRegistered: true });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

function clampFlipScore(n) {
  return Math.max(0, Math.min(10, n));
}

/**
 * POST /api/flip-rewards/cancel-listing
 * Marks quick-cancel abuse when user cancels shortly after listing.
 */
router.post('/cancel-listing', async (req, res) => {
  try {
    const sellerListingId = extractSellerListingId(req.body.sellerListingId || req.body.listingId);
    if (!sellerListingId) {
      return res.status(400).json({ message: 'listing id required' });
    }
    const track = await FlipTrackedListing.findOne({
      user: req.user.id,
      sellerListingId,
    });
    if (!track) return res.status(404).json({ message: 'Tracked listing not found' });
    const listedAt = track.listedAt instanceof Date ? track.listedAt : new Date(track.listedAt);
    if (Date.now() - listedAt.getTime() < EARLY_CANCEL_WINDOW_MS) {
      track.cancelledEarly = true;
      track.status = 'void';
      await track.save();
    } else {
      track.status = 'void';
      await track.save();
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('flip-rewards cancel-listing', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/flip-rewards/confirm-sale
 */
router.post('/confirm-sale', async (req, res) => {
  try {
    const premium = await isPremiumUser(req.user.id);
    const sellerListingId = extractSellerListingId(req.body.sellerListingId || req.body.listingId);
    if (!sellerListingId) {
      return res.status(400).json({ message: 'seller listing id required' });
    }
    const soldPrice = Number(req.body.soldPrice);
    if (!Number.isFinite(soldPrice) || soldPrice <= 0) {
      return res.status(400).json({ message: 'valid soldPrice required' });
    }
    const soldAt = req.body.soldAt ? new Date(req.body.soldAt) : new Date();
    const feePct = req.body.feePct != null ? Number(req.body.feePct) : undefined;
    const verification = String(req.body.verification || 'user');

    const track = await FlipTrackedListing.findOne({
      user: req.user.id,
      sellerListingId,
    });
    if (!track) {
      return res.status(404).json({
        message: 'No flip-tracked listing found. Register your listing from Promote or the listing assistant first.',
      });
    }

    const abuse = passesAntiAbuse(track, soldAt, verification);
    if (!abuse.ok) {
      return res.status(400).json({ code: abuse.code, message: abuse.message });
    }

    const stack = computeSaleStack(track, { soldPrice, soldAt, feePct, verification }, { premium });
    const idemRaw =
      typeof req.body.idempotencyKey === 'string' && req.body.idempotencyKey.trim().length > 8
        ? req.body.idempotencyKey.trim().slice(0, 120)
        : null;
    const idempotencyKey =
      idemRaw ||
      `flip_sale_stack_${req.user.id}_${sellerListingId}_${soldAt.getTime()}`;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const existing = await SavvyFlipRewardLog.findOne({ idempotencyKey }).lean();
    if (existing) {
      let bd = [];
      if (Array.isArray(existing.breakdown)) bd = existing.breakdown;
      else if (Array.isArray(existing.breakdown?.breakdown)) bd = existing.breakdown.breakdown;
      const fsDup =
        existing.flipScoreAtCompletion != null
          ? Math.round(Number(existing.flipScoreAtCompletion) * 10) / 10
          : null;
      return res.json({
        success: true,
        duplicate: true,
        totalPoints: existing.points,
        breakdown: bd,
        headline: '🔥 Smart Flip Complete!',
        subcopy: '💰 You made a smart move',
        savvyLine: `+${existing.points} Savvy Points banked`,
        flipScoreExecuted: fsDup,
        executionLine:
          fsDup != null ? `You executed a ${fsDup} Flip Score deal` : null,
        eliteBadgeUnlocked: fsDup != null && fsDup >= 8.5,
      });
    }

    const fsCompletion =
      stack.flipScoreUsed != null ? stack.flipScoreUsed : Number(track.flipScore);
    const hadEliteBadge =
      Array.isArray(user.badges) && user.badges.includes('elite_flip');

    const saleCredit = await creditSavvyWithCap(
      user,
      stack.totalPoints,
      premium,
      idempotencyKey,
      'flip_sale_stack',
      sellerListingId,
      { breakdown: stack.breakdown, preMult: stack.preMult, roiPct: stack.roiPct, multiplier: stack.multiplier },
      fsCompletion
    );
    const { awarded, capped, ledgerWritten } = saleCredit;

    if (!ledgerWritten) {
      await recordFlipRewardStub(
        user._id,
        idempotencyKey,
        'sale_stack',
        sellerListingId,
        {
          reason: stack.totalPoints > 0 ? 'daily_cap' : 'zero_stack',
          requested: stack.totalPoints,
        },
        capped,
        fsCompletion
      );
    }

    track.status = 'sold';
    await track.save();

    bumpFlipGamification(user, track.flipScore);
    await user.save();

    const breakdownOut = stack.breakdown.map((b) => ({
      label: b.label,
      points: b.points,
    }));
    const capShortfall = Math.max(0, stack.totalPoints - awarded);
    if (capShortfall > 0 && !premium) {
      breakdownOut.push({
        label: 'Free daily cap',
        points: -capShortfall,
        cap: true,
      });
    }

    const fsOut = Number.isFinite(fsCompletion) ? Math.round(fsCompletion * 10) / 10 : null;
    const eliteNow = fsOut != null && fsOut >= 8.5;
    const eliteFresh = eliteNow && !hadEliteBadge;

    return res.json({
      success: true,
      totalPoints: awarded,
      theoreticalTotal: stack.totalPoints,
      dailyCapShortfall: capShortfall,
      premium,
      roiPct: stack.roiPct,
      multiplier: stack.multiplier,
      breakdown: breakdownOut,
      headline: '🔥 Smart Flip Complete!',
      subcopy: '💰 You made a smart move',
      savvyLine: `+${awarded} Savvy Points banked`,
      flipScoreExecuted: fsOut,
      executionLine: fsOut != null ? `You executed a ${fsOut} Flip Score deal` : null,
      eliteBadgeUnlocked: eliteFresh,
      eliteFlipBadge: eliteNow,
      flipGamification: {
        bestFlipScoreEver: user.flipBestScoreEver != null ? Math.round(user.flipBestScoreEver * 10) / 10 : null,
        totalFlipsCompleted: user.flipTotalCompleted || 0,
        averageFlipScore:
          user.flipTotalCompleted > 0
            ? Math.round((user.flipScoreLifetimeSum / user.flipTotalCompleted) * 10) / 10
            : null,
      },
    });
  } catch (err) {
    console.error('flip-rewards confirm-sale', err);
    if (err?.code === 11000) {
      return res.json({
        success: true,
        duplicate: true,
        headline: '🔥 Smart Flip Complete!',
        subcopy: '💰 You made a smart move',
      });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
