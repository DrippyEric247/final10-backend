/**
 * Savvy Points — Flip Rewards (listing + verified sale stacks).
 * Flip Score tiers adjust listing payout and sale-stack boost (keep in sync with client `flipSavvyPotential.ts`).
 */

const LISTING_BASE = 10;
const LISTING_AI_MATCH = 20;
const SALE_COMPLETE = 50;
const SMART_PRICING = 30;
const SPEED_BONUS = 25;

const MIN_LISTING_ACTIVE_MS = 18 * 60 * 60 * 1000;
const EARLY_CANCEL_WINDOW_MS = 4 * 60 * 60 * 1000;

/** Free users: max Savvy Points from flip rewards per UTC day */
const FREE_FLIP_REWARD_DAILY_CAP = 220;

const DEFAULT_FEE = 13.5;

/** Max sale components before flip-score % boost (all optional lines earned). */
const SALE_CORE_MAX = SALE_COMPLETE + SMART_PRICING + SPEED_BONUS;

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Multiplier on listing bonus Savvy by Flip Score band.
 * @returns {number} 0 = no listing Savvy (&lt;5), then 1 / 1.2 / 1.5
 */
function flipScoreListingMultiplier(flipScore) {
  if (flipScore == null || flipScore === '') return 1;
  const fs = Number(flipScore);
  if (!Number.isFinite(fs)) return 1;
  if (fs < 5) return 0;
  if (fs < 7) return 1;
  if (fs < 8.5) return 1.2;
  return 1.5;
}

/**
 * Fraction of (sale + smart + speed) pre-boost stack added as Flip Score boost.
 * @returns {number} 0 below 7, 20% for 7–8.4, 50% for 8.5+
 */
function flipScoreSaleBoostFraction(flipScore) {
  if (flipScore == null || flipScore === '') return 0;
  const fs = Number(flipScore);
  if (!Number.isFinite(fs) || fs < 7) return 0;
  if (fs < 8.5) return 0.2;
  return 0.5;
}

function listingBonusPoints(fromAiSuggestion) {
  return LISTING_BASE + (fromAiSuggestion ? LISTING_AI_MATCH : 0);
}

/**
 * Listing Savvy after Flip Score tier (may be 0 when score &lt; 5).
 */
function computeListingBonusAfterFlipScore(fromAiSuggestion, flipScore) {
  const base = listingBonusPoints(fromAiSuggestion);
  const m = flipScoreListingMultiplier(flipScore);
  return Math.round(base * m);
}

function profitRoiMultiplier(roiPct, premium) {
  const r = Number(roiPct);
  if (!Number.isFinite(r) || r < 10) return { mult: 1, tier: 'base' };
  if (premium) {
    if (r >= 40) return { mult: 2.15, tier: '40p' };
    if (r >= 20) return { mult: 1.65, tier: '20p' };
    return { mult: 1.25, tier: '10p' };
  }
  if (r >= 40) return { mult: 2.0, tier: '40p' };
  if (r >= 20) return { mult: 1.5, tier: '20p' };
  return { mult: 1.2, tier: '10p' };
}

function netRoiPctAfterFees(soldPrice, buyPrice, feePct) {
  const sp = Number(soldPrice);
  const bp = Number(buyPrice);
  const f = clamp(Number(feePct) || DEFAULT_FEE, 0, 50) / 100;
  if (!Number.isFinite(sp) || !Number.isFinite(bp) || bp <= 0) return 0;
  const net = sp * (1 - f) - bp;
  return (net / bp) * 100;
}

/**
 * Upper-bound Savvy for UI ("up to") — assumes all sale lines + best ROI tier.
 */
function estimateMaxFlipSavvyPotential({ flipScore, fromAi, premium }) {
  const listing = computeListingBonusAfterFlipScore(Boolean(fromAi), flipScore);
  const fs = Number(flipScore);
  const core = SALE_CORE_MAX;
  const frac = flipScoreSaleBoostFraction(fs);
  const boostedCore = Math.round(core * (1 + frac));
  const maxRoi = premium ? 2.15 : 2.0;
  const saleCap = Math.round(boostedCore * maxRoi);
  return {
    maxTotal: listing + saleCap,
    listing,
    saleCap,
    flipScoreTier: describeFlipScoreSavvyTier(fs),
  };
}

function describeFlipScoreSavvyTier(fs) {
  if (!Number.isFinite(fs)) return 'standard';
  if (fs < 5) return 'none';
  if (fs < 7) return 'base';
  if (fs < 8.5) return 'strong';
  return 'elite';
}

/**
 * @param {object} track mongoose doc or plain object with flip fields
 * @param {{ soldPrice: number, soldAt: Date, feePct?: number, verification?: string }} input
 * @param {{ premium: boolean }} opts
 */
function computeSaleStack(track, input, opts = { premium: false }) {
  const soldAt = input.soldAt instanceof Date ? input.soldAt : new Date(input.soldAt || Date.now());
  const soldPrice = Number(input.soldPrice);
  const feePct = input.feePct != null ? Number(input.feePct) : DEFAULT_FEE;
  const listedAt = track.listedAt instanceof Date ? track.listedAt : new Date(track.listedAt);
  const buyPrice = Number(track.buyPrice) || 0;
  const predicted = Math.max(1, Number(track.predictedDaysToSell) || 14);
  const smin = Number(track.suggestedMin) || 0;
  const smax = Number(track.suggestedMax) || 0;
  const flipScore = Number(track.flipScore);

  const lines = [];
  let preMult = 0;

  preMult += SALE_COMPLETE;
  lines.push({ key: 'sale', label: 'Sale', points: SALE_COMPLETE });

  const lo = smin > 0 ? smin * 0.96 : null;
  const hi = smax > 0 ? smax * 1.04 : null;
  const inSuggestedRange =
    lo != null && hi != null && Number.isFinite(soldPrice) && soldPrice >= lo && soldPrice <= hi;
  if (inSuggestedRange) {
    preMult += SMART_PRICING;
    lines.push({ key: 'smart_pricing', label: 'Smart pricing', points: SMART_PRICING });
  }

  const msListed = soldAt.getTime() - listedAt.getTime();
  const daysListed = msListed / 86400000;
  const withinPredictedWindow = daysListed <= predicted + 0.5;
  const fasterThanExpected = daysListed < predicted;
  if (fasterThanExpected && withinPredictedWindow) {
    preMult += SPEED_BONUS;
    lines.push({ key: 'speed', label: 'Speed', points: SPEED_BONUS });
  }

  const boostFrac = flipScoreSaleBoostFraction(flipScore);
  if (boostFrac > 0 && preMult > 0) {
    const flipBoost = Math.round(preMult * boostFrac);
    if (flipBoost > 0) {
      preMult += flipBoost;
      lines.push({
        key: 'flip_score_boost',
        label: flipScore >= 8.5 ? 'Flip score boost (Elite)' : 'Flip score boost',
        points: flipBoost,
      });
    }
  }

  const roiPct = netRoiPctAfterFees(soldPrice, buyPrice, feePct);
  const { mult } = profitRoiMultiplier(roiPct, opts.premium);
  const totalRounded = Math.round(preMult * mult);
  const profitBoost = totalRounded - preMult;
  if (profitBoost !== 0) {
    lines.push({ key: 'profit_boost', label: 'Profit boost', points: profitBoost });
  }

  return {
    preMult,
    roiPct: Math.round(roiPct * 10) / 10,
    multiplier: mult,
    totalPoints: totalRounded,
    breakdown: lines,
    flipScoreUsed: Number.isFinite(flipScore) ? Math.round(flipScore * 10) / 10 : null,
  };
}

function passesAntiAbuse(track, soldAt, verification) {
  if (track.cancelledEarly) {
    return { ok: false, code: 'cancelled_early', message: 'Listing was cancelled too soon to qualify.' };
  }
  if (track.status !== 'open') {
    return { ok: false, code: 'not_open', message: 'This listing is not eligible for a new sale reward.' };
  }
  const listedAt = track.listedAt instanceof Date ? track.listedAt : new Date(track.listedAt);
  const sold = soldAt instanceof Date ? soldAt : new Date(soldAt);
  if (sold.getTime() < listedAt.getTime()) {
    return { ok: false, code: 'invalid_dates', message: 'Sale date must be after you registered the listing.' };
  }
  if (sold.getTime() - listedAt.getTime() < MIN_LISTING_ACTIVE_MS) {
    return {
      ok: false,
      code: 'min_active',
      message: 'Flip rewards unlock after your listing has been active long enough.',
    };
  }
  const v = String(verification || 'user').toLowerCase();
  if (v !== 'api' && v !== 'user' && v !== 'user_confirmed') {
    return { ok: false, code: 'verification', message: 'Unsupported verification source.' };
  }
  return { ok: true };
}

/**
 * Apply free-tier daily cap. Mutates `user` flip reward counters for the UTC day.
 * @returns {{ award: number, capped: number }}
 */
function applyDailyCap(userDoc, pointsToAdd, premium) {
  if (premium) {
    return { award: Math.max(0, Math.round(pointsToAdd)), capped: 0 };
  }
  const want = Math.max(0, Math.round(pointsToAdd));
  const day = utcDayKey();
  if (userDoc.flipRewardsDay !== day) {
    userDoc.flipRewardsDay = day;
    userDoc.flipRewardsPointsToday = 0;
  }
  const used = Number(userDoc.flipRewardsPointsToday) || 0;
  const room = Math.max(0, FREE_FLIP_REWARD_DAILY_CAP - used);
  const award = Math.min(want, room);
  const capped = want - award;
  userDoc.flipRewardsPointsToday = used + award;
  return { award, capped };
}

module.exports = {
  LISTING_BASE,
  LISTING_AI_MATCH,
  SALE_COMPLETE,
  SMART_PRICING,
  SPEED_BONUS,
  SALE_CORE_MAX,
  MIN_LISTING_ACTIVE_MS,
  EARLY_CANCEL_WINDOW_MS,
  FREE_FLIP_REWARD_DAILY_CAP,
  utcDayKey,
  flipScoreListingMultiplier,
  flipScoreSaleBoostFraction,
  listingBonusPoints,
  computeListingBonusAfterFlipScore,
  estimateMaxFlipSavvyPotential,
  computeSaleStack,
  passesAntiAbuse,
  applyDailyCap,
  netRoiPctAfterFees,
};
