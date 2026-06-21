/**
 * Beta deal scoring for alert test mode — relaxed thresholds vs production alerts.
 */

const {
  BETA_MIN_SAVINGS_PCT,
  BETA_MIN_TRUST_SCORE,
  BETA_MIN_RANKED_ABOVE_PCT,
} = require('../lib/alertTestModeConfig');

function computeTrustScore(item) {
  let score = 55;
  const fb = Number(item.sellerFeedbackPercent);
  if (Number.isFinite(fb)) {
    score = Math.round(Math.min(99, fb) * 0.92);
  }
  if (item.sellerTopRated) score += 6;
  const count = Number(item.sellerFeedbackCount);
  if (Number.isFinite(count) && count >= 500) score += 4;
  if (Number.isFinite(count) && count >= 2000) score += 2;
  return Math.max(0, Math.min(100, score));
}

function computeRankedAbovePercent(item, pool) {
  const live = Number(item.price ?? item.currentBidPrice ?? item.buyNowPrice);
  if (!Number.isFinite(live) || live <= 0) return 50;
  const prices = (pool || [])
    .map((p) => Number(p.price ?? p.currentBidPrice ?? p.buyNowPrice))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length < 2) return 75;
  const cheaperOrEqual = prices.filter((p) => p >= live).length;
  return Math.round((cheaperOrEqual / prices.length) * 100);
}

function passesBetaTrigger({ savingsPct, trustScore, rankedAbovePercent }) {
  const savings = Number(savingsPct);
  const trust = Number(trustScore);
  const ranked = Number(rankedAbovePercent);
  if (Number.isFinite(savings) && savings >= BETA_MIN_SAVINGS_PCT) return true;
  if (Number.isFinite(trust) && trust >= BETA_MIN_TRUST_SCORE) return true;
  if (Number.isFinite(ranked) && ranked >= BETA_MIN_RANKED_ABOVE_PCT) return true;
  return false;
}

function computeDealScore(item) {
  const savings = Math.max(0, Number(item.savingsPct) || 0);
  const trust = Math.max(0, Number(item.trustScore) || 0);
  const ranked = Math.max(0, Number(item.rankedAbovePercent) || 0);
  const confidence = Math.max(0, Math.min(1, Number(item.confidenceScore) || 0.5));
  const betaBoost = item.passesBetaTrigger ? 12 : 0;
  return (
    Math.round(
      savings * 0.45 +
        trust * 0.3 +
        ranked * 0.15 +
        confidence * 10 +
        betaBoost
    ) * 10
  ) / 10;
}

function isPs5DiscListing(title) {
  const t = String(title || '').toLowerCase();
  if (!/(ps5|playstation\s*5)/i.test(t)) return false;
  if (/(digital|code|account|gift\s*card|box\s*only|manual\s*only|empty\s*box)/i.test(t)) {
    return false;
  }
  return true;
}

function buildWhyPickedReasons(item) {
  const reasons = [];
  if (item.recommendationReason) reasons.push(String(item.recommendationReason));
  if (Number(item.savingsPct) >= BETA_MIN_SAVINGS_PCT) {
    reasons.push(`Estimated ${Math.round(Number(item.savingsPct))}% below comparable market asks`);
  }
  if (Number(item.trustScore) >= BETA_MIN_TRUST_SCORE) {
    reasons.push(`Seller trust score ${Math.round(Number(item.trustScore))}/100 — strong beta signal`);
  }
  if (Number(item.rankedAbovePercent) >= BETA_MIN_RANKED_ABOVE_PCT) {
    reasons.push(`Ranks above ${Math.round(Number(item.rankedAbovePercent))}% of listings in this sweep`);
  }
  if (item.sellerTopRated) reasons.push('Top Rated seller on eBay');
  if (!reasons.length) reasons.push('Savvy Scout flagged this as the best PS5 disc match in the beta sweep');
  return reasons.slice(0, 5);
}

module.exports = {
  computeTrustScore,
  computeRankedAbovePercent,
  passesBetaTrigger,
  computeDealScore,
  isPs5DiscListing,
  buildWhyPickedReasons,
};
