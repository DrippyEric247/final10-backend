/**
 * Server-authoritative listing ranking (Wave 4).
 * Mirrors client trust + best move formulas without changing scoring weights.
 */
const { evaluateListingTrust } = require('../lib/listingRanking/trustScoreEngine');
const { evaluateBestMove } = require('../lib/listingRanking/bestMoveEngine');
const { buildSellerTrustEvidence } = require('../lib/listingRanking/sellerTrustEvidence');
const { toNum } = require('../lib/listingRanking/utils');

const RECOMMENDATION_WEIGHT = {
  buy_now_better: 4,
  auction_better: 3,
  wait_and_watch: 2,
  pass: 1,
};

function feedbackCount(item) {
  const s = item.seller;
  if (s && typeof s === 'object') {
    const n = Number(s.feedbackScore ?? s.feedbackCount);
    if (Number.isFinite(n)) return n;
  }
  const flat = Number(item.sellerFeedbackCount ?? item.sellerFeedbackScore);
  return Number.isFinite(flat) ? flat : 0;
}

function computeCompositeRank(item, trust, decision) {
  const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? 0);
  const market = Number(item.marketValue ?? 0);
  const savings = Math.max(0, market - price);
  const savingsPct = market > 0 ? (savings / market) * 100 : 0;
  const trustScore = Number(trust.trustScore) || 0;
  const sellerRep = Math.min(100, feedbackCount(item) / 8);
  const shipConf =
    Number(item.shippingCost) === 0 || item.freeShipping || item.shippingFree ? 88 : 55;
  const secondsRemaining = Math.max(0, Number(item.secondsRemaining) || 0);
  const urgency =
    secondsRemaining <= 15 * 60 ? 92 : secondsRemaining <= 3600 ? 78 : secondsRemaining <= 21600 ? 63 : 40;
  const activity =
    Math.max(0, Number(item.bidCount || 0) * 8) +
    (Number(decision.confidenceScore) || 0) * 60;

  return (
    Math.min(300, savings) * 0.85 +
    Math.min(60, savingsPct) * 2.2 +
    trustScore * 1.35 +
    sellerRep * 0.9 +
    shipConf * 0.35 +
    urgency * 0.55 +
    activity * 0.75
  );
}

function buildLabels(trust, decision, risky, item) {
  const labels = [];
  if (decision.recommendationType === 'buy_now_better') labels.push('BEST_MOVE');
  if (trust.trustLevel === 'high') labels.push('HIGH_TRUST');
  if (trust.trustLevel === 'unverified' || risky) labels.push('LOW_TRUST');
  if ((Number(item?.bidCount) || 0) <= 2 && trust.trustScore >= 55) labels.push('LOW_COMPETITION');
  return labels;
}

function scoreListing(listing, options = {}) {
  const item = listing && typeof listing === 'object' ? listing : {};
  const trust = evaluateListingTrust(item);
  const decision = evaluateBestMove({
    currentBid: item.currentBidPrice ?? item.currentBid,
    buyNowPrice: item.buyNowPrice,
    marketValue: item.marketValue,
    marketConfidence: item.marketConfidence,
    trustScore: trust.trustScore,
    bidCount: item.bidCount,
    secondsRemaining: item.secondsRemaining,
    condition: item.condition,
    shippingCost: item.shippingCost,
    isAuction: item.isAuction,
    isBuyNow: item.isBuyNow,
  });

  const risky =
    !trust.safeToRecommend ||
    trust.trustLevel === 'unverified' ||
    (trust.trustScore < 32 && feedbackCount(item) < 5);

  let rankScore = computeCompositeRank(item, trust, decision);
  if (risky) rankScore *= 0.35;

  const tierBoost = Number(options.tierBoost) || 0;
  rankScore += tierBoost;

  const labels = [];
  if (decision.recommendationType === 'buy_now_better' && !risky) labels.push('BEST_MOVE');
  if (trust.trustLevel === 'high') labels.push('HIGH_TRUST');
  if (trust.trustLevel === 'unverified' || risky) labels.push('LOW_TRUST');
  if ((Number(item.bidCount) || 0) <= 2 && trust.trustScore >= 55 && !risky) {
    labels.push('LOW_COMPETITION');
  }

  return {
    listingId: String(item.listingId || item.id || item.itemId || ''),
    rankScore: Math.round(rankScore * 100) / 100,
    sellerEvidence: buildSellerTrustEvidence(item, trust),
    signals: {
      trustScore: trust.trustScore,
      trustLevel: trust.trustLevel,
      dealScore: decision.dealScore,
      competitionScore: scoreBidCompetitionProxy(item),
      savingsScore: computeSavingsScore(item),
      urgencyScore: scoreTimeProxy(item),
      sellerScore: Math.min(100, feedbackCount(item) / 8),
      safeToRecommend: trust.safeToRecommend,
      recommendationType: decision.recommendationType,
    },
    labels,
    risky,
    explanation: decision.recommendationType,
    trust,
    decision,
  };
}

function scoreBidCompetitionProxy(item) {
  const bidCount = Math.max(0, Number(item.bidCount) || 0);
  if (bidCount <= 1) return 84;
  if (bidCount <= 4) return 72;
  if (bidCount <= 8) return 55;
  return 30;
}

function scoreTimeProxy(item) {
  const secondsRemaining = Math.max(0, Number(item.secondsRemaining) || 0);
  if (!item.isAuction || secondsRemaining <= 0) return 60;
  if (secondsRemaining <= 15 * 60) return 92;
  if (secondsRemaining <= 60 * 60) return 78;
  return 52;
}

function computeSavingsScore(item) {
  const price = Number(item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? 0);
  const market = Number(item.marketValue ?? 0);
  if (market <= 0) return 0;
  return Math.max(0, Math.min(100, ((market - price) / market) * 100));
}

/**
 * Rank listings server-side. Ignores any client-supplied rankScore/trustScore fields.
 */
function rankListings(listings, options = {}) {
  const rows = Array.isArray(listings) ? listings : [];
  const scored = rows.map((listing) => scoreListing(listing, options));

  scored.sort((a, b) => {
    if (a.risky !== b.risky) return a.risky ? 1 : -1;
    const recDiff =
      (RECOMMENDATION_WEIGHT[b.signals.recommendationType] || 0) -
      (RECOMMENDATION_WEIGHT[a.signals.recommendationType] || 0);
    if (recDiff !== 0) return recDiff;
    if (b.signals.trustScore !== a.signals.trustScore) {
      return b.signals.trustScore - a.signals.trustScore;
    }
    return b.rankScore - a.rankScore;
  });

  return scored.map((row, index) => ({
    ...row,
    rankPosition: index + 1,
    trust: undefined,
    decision: undefined,
  }));
}

module.exports = {
  scoreListing,
  rankListings,
};
