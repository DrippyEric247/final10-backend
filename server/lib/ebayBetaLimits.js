/**
 * Railway beta memory guards — cap eBay fan-out and payload size.
 */
const { isProduction } = require('../config/envValidation');

/** Max items returned per /api/ebay/search request */
const MAX_SEARCH_LIMIT = isProduction()
  ? clampInt(process.env.EBAY_BETA_SEARCH_LIMIT, 8, 30, 24)
  : clampInt(process.env.EBAY_BETA_SEARCH_LIMIT, 8, 200, 50);

/** Max pool fetched for /api/ebay/final10 before client-side filter */
const MAX_FINAL10_POOL = isProduction()
  ? clampInt(process.env.EBAY_BETA_POOL_LIMIT, 10, 40, 30)
  : clampInt(process.env.EBAY_BETA_POOL_LIMIT, 10, 200, 60);

/** Max listings enriched with True Market Value per request */
const MAX_ENRICH_ITEMS = isProduction()
  ? clampInt(process.env.EBAY_BETA_ENRICH_LIMIT, 4, 16, 8)
  : clampInt(process.env.EBAY_BETA_ENRICH_LIMIT, 4, 40, 16);

/** Max eBay Browse API limit per upstream call */
const MAX_BROWSE_API_LIMIT = isProduction() ? 30 : 200;

const EBAY_FETCH_TIMEOUT_MS = clampInt(process.env.EBAY_FETCH_TIMEOUT_MS, 3000, 30000, 12000);

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampSearchLimit(raw) {
  const n = parseInt(raw, 10);
  const base = Number.isFinite(n) && n > 0 ? n : 20;
  return Math.min(base, MAX_SEARCH_LIMIT);
}

function clampFinal10OutLimit(raw) {
  const n = parseInt(raw, 10);
  const base = Number.isFinite(n) && n > 0 ? n : 20;
  return Math.min(base, MAX_SEARCH_LIMIT);
}

function clampBrowseLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return MAX_SEARCH_LIMIT;
  return Math.min(n, MAX_BROWSE_API_LIMIT);
}

/** Strip heavy fields — keep only what Quick Snipes / Best Move need. */
function slimListingPayload(item) {
  if (!item || typeof item !== 'object') return item;
  const id = item.itemId || item.id;
  const image = item.imageUrl || item.image || null;
  const url = item.itemWebUrl || item.url || null;
  const seller = item.sellerUsername || item.seller || null;
  const slim = {
    itemId: id,
    id,
    title: String(item.title || '').slice(0, 200),
    price: item.price ?? item.currentBidPrice ?? item.buyNowPrice ?? null,
    currentBidPrice: item.currentBidPrice ?? null,
    buyNowPrice: item.buyNowPrice ?? null,
    image,
    imageUrl: image,
    itemWebUrl: url,
    url,
    seller,
    sellerUsername: seller,
    trustScore: item.trustScore ?? null,
    trustLevel: item.trustLevel ?? null,
    savings: item.savings ?? null,
    savingsPct: item.savingsPct ?? null,
    marketValue: item.marketValue ?? null,
    marketConfidence: item.marketConfidence ?? null,
    bidCount: item.bidCount ?? 0,
    secondsRemaining: item.secondsRemaining ?? 0,
    isAuction: Boolean(item.isAuction),
    isBuyNow: Boolean(item.isBuyNow),
    recommendationType: item.recommendationType ?? null,
    confidenceScore: item.confidenceScore ?? null,
    recommendationReason: item.recommendationReason
      ? String(item.recommendationReason).slice(0, 180)
      : null,
    condition: item.condition ? String(item.condition).slice(0, 40) : '',
    currency: item.currency || 'USD',
    endingSoon: Boolean(item.endingSoon),
  };
  if (item.marketStats && typeof item.marketStats === 'object') {
    slim.marketStats = {
      median: item.marketStats.median ?? null,
      confidence: item.marketStats.confidence ?? null,
      count: item.marketStats.count ?? null,
    };
  }
  return slim;
}

function slimListingList(items) {
  return (items || []).map(slimListingPayload);
}

module.exports = {
  MAX_SEARCH_LIMIT,
  MAX_FINAL10_POOL,
  MAX_ENRICH_ITEMS,
  MAX_BROWSE_API_LIMIT,
  EBAY_FETCH_TIMEOUT_MS,
  clampSearchLimit,
  clampFinal10OutLimit,
  clampBrowseLimit,
  slimListingPayload,
  slimListingList,
};
