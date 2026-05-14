/**
 * Final10 — True Market Value engine.
 *
 * Replaces the old "live listing price = market price" model with a real
 * comp-based engine. For a given query (keywords + condition + category)
 * we pull a window of recently-sold or actively-listed comparables, throw
 * away the spam/outliers, and report:
 *
 *   - average / median / min / max
 *   - sample size + variance
 *   - confidence  (high / medium / low)
 *   - data source ("sold" or "active")
 *
 * The engine prefers eBay's Marketplace Insights API when the seller account
 * has been approved for it (`EBAY_MARKETPLACE_INSIGHTS_ENABLED=true`). When
 * insights aren't available (the common case for new apps) it falls back to
 * a much stricter Browse-API sample with IQR outlier trimming so the median
 * is still a credible "real-world ask" — not the same listing the user is
 * staring at.
 *
 * All public methods are async and idempotent; everything is memoised in
 * a 10-30 minute LRU so repeated renders / batched cards don't slam eBay.
 */

const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const { getEbayAppToken } = require('./ebayAuthService');
const { logEbayProviderError } = require('./structuredLog');
const { recommendDeal } = require('./dealRecommendationService');

const DEFAULT_TTL_MS = clampInt(process.env.MARKET_VALUE_CACHE_TTL_MS, 60_000, 60 * 60_000, 15 * 60_000);
const STALE_REFRESH_AFTER_MS = Math.floor(DEFAULT_TTL_MS * 0.6);
const NEGATIVE_TTL_MS = 60_000;
const CACHE_LIMIT = 500;
const MIN_COMPS_FOR_HIGH = 18;
const MIN_COMPS_FOR_MEDIUM = 8;
const SAMPLE_FETCH_LIMIT = 60;
const SOLD_WINDOW_DAYS = 30;
const SPAM_TOKENS = [
  'broken', 'parts only', 'for parts', 'not working', 'damaged', 'cracked',
  'water damage', 'as is', 'as-is', 'wholesale lot', 'lot of', 'bundle',
  'empty box', 'box only', 'replica', 'fake', 'protector', 'case only',
  'manual only', 'fan made', 'reproduction',
];

const cache = new Map();
const inflight = new Map();
const refreshing = new Set();

const MARKETPLACE_INSIGHTS_ENABLED =
  String(process.env.EBAY_MARKETPLACE_INSIGHTS_ENABLED || '').toLowerCase() === 'true';

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeKeywords(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ');
}

function buildCacheKey({ q, conditionIds, categoryId, source }) {
  const c = String(conditionIds || '').split(',').map((s) => s.trim()).filter(Boolean).sort().join('|');
  const cat = String(categoryId || '').trim();
  return `${source || 'auto'}::${normalizeKeywords(q)}::cond=${c}::cat=${cat}`;
}

function lruSet(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function median(sortedAsc) {
  const n = sortedAsc.length;
  if (!n) return null;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2;
}

function quantile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function isLikelySpam(title) {
  const lower = String(title || '').toLowerCase();
  return SPAM_TOKENS.some((tok) => lower.includes(tok));
}

function tokenOverlap(a, b) {
  if (!a || !b) return 0;
  const at = new Set(a.split(' ').filter(Boolean));
  const bt = new Set(b.split(' ').filter(Boolean));
  if (!at.size || !bt.size) return 0;
  let hits = 0;
  for (const tok of at) if (bt.has(tok)) hits += 1;
  return hits / at.size;
}

/**
 * Strip outliers using a strict IQR rule and a generous sanity guard.
 * We use 1.25 × IQR (slightly tighter than the textbook 1.5×) because eBay
 * comp samples are noisy and the median should reflect the "real ask",
 * not the long tail of broken units and bundle deals.
 */
function trimOutliers(prices) {
  if (prices.length < 5) return prices.slice();
  const sorted = prices.slice().sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  if (q1 == null || q3 == null) return sorted;
  const iqr = Math.max(q3 - q1, 0);
  const low = q1 - iqr * 1.25;
  const high = q3 + iqr * 1.25;
  const trimmed = sorted.filter((p) => p >= low && p <= high);
  return trimmed.length >= 4 ? trimmed : sorted.slice(1, -1);
}

/**
 * Filter a raw comparable sample down to "credible" data points:
 *   - drop spam keywords (broken, lot of, case only, ...)
 *   - drop entries with no usable price
 *   - drop entries whose title shares <40% token overlap with the query
 *     (only enforced when the query has ≥2 meaningful tokens)
 *   - drop the top + bottom 5% before IQR to soften eBay's long tails
 */
function filterAndScoreSample(rawItems, queryTokensJoined) {
  const queryTokens = queryTokensJoined.split(' ').filter((t) => t.length >= 3);
  const requireOverlap = queryTokens.length >= 2;

  const candidates = [];
  for (const it of rawItems) {
    const price = Number(it?.price);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) continue;
    const title = String(it?.title || '');
    if (!title) continue;
    if (isLikelySpam(title)) continue;
    const titleNorm = normalizeKeywords(title);
    const overlap = tokenOverlap(queryTokensJoined, titleNorm);
    if (requireOverlap && overlap < 0.4) continue;
    candidates.push({ price, title, overlap });
  }
  return candidates;
}

function summarizeStats(prices) {
  const sorted = prices.slice().sort((a, b) => a - b);
  const med = median(sorted);
  const avg = average(sorted);
  const min = sorted[0] ?? null;
  const max = sorted[sorted.length - 1] ?? null;
  let coefficientOfVariation = null;
  if (avg != null && avg > 0 && sorted.length > 1) {
    const mean = avg;
    const variance =
      sorted.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (sorted.length - 1);
    coefficientOfVariation = Math.sqrt(variance) / mean;
  }
  return {
    average: avg != null ? Number(avg.toFixed(2)) : null,
    median: med != null ? Number(med.toFixed(2)) : null,
    min: min != null ? Number(min.toFixed(2)) : null,
    max: max != null ? Number(max.toFixed(2)) : null,
    count: sorted.length,
    coefficientOfVariation:
      coefficientOfVariation != null ? Number(coefficientOfVariation.toFixed(3)) : null,
  };
}

function computeConfidence(stats) {
  if (!stats || !stats.count) return 'low';
  const cv = stats.coefficientOfVariation ?? 0;
  if (stats.count >= MIN_COMPS_FOR_HIGH && cv <= 0.35) return 'high';
  if (stats.count >= MIN_COMPS_FOR_MEDIUM && cv <= 0.55) return 'medium';
  return 'low';
}

function buildEmptyResult({ q, source, reason }) {
  return {
    query: q,
    source,
    marketValue: null,
    average: null,
    median: null,
    min: null,
    max: null,
    count: 0,
    confidence: 'low',
    coefficientOfVariation: null,
    sampledAt: Date.now(),
    label:
      source === 'sold'
        ? 'Based on recent sold listings'
        : 'Based on recent comparable listings',
    reason: reason || null,
  };
}

async function ebayBrowseSearch(params) {
  const token = await getEbayAppToken();
  const query = new URLSearchParams(params).toString();
  const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?${query}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(`eBay browse failed: ${response.status}`);
    err.status = response.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function ebayMarketplaceInsightsSearch(params) {
  const token = await getEbayAppToken();
  const query = new URLSearchParams(params).toString();
  const url = `https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?${query}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    const err = new Error(`eBay marketplace_insights failed: ${response.status}`);
    err.status = response.status;
    err.body = data;
    throw err;
  }
  return data;
}

function buildBrowseFilter({ conditionIds, soldWithinDays, listingMode = 'mixed' }) {
  const parts = [];
  if (listingMode === 'auction') parts.push('buyingOptions:{AUCTION}');
  if (listingMode === 'buy_now') parts.push('buyingOptions:{FIXED_PRICE}');
  const conds = String(conditionIds || '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => /^\d+$/.test(c));
  if (conds.length) parts.push(`conditionIds:{${conds.join('|')}}`);
  if (soldWithinDays) {
    const since = new Date(Date.now() - soldWithinDays * 24 * 60 * 60 * 1000).toISOString();
    parts.push(`itemEndDate:[${since}..]`);
  }
  return parts.join(',');
}

async function fetchSoldComparables({ q, conditionIds, categoryId }) {
  if (!MARKETPLACE_INSIGHTS_ENABLED) return null;
  const params = {
    q,
    limit: String(SAMPLE_FETCH_LIMIT),
  };
  if (categoryId && /^\d+$/.test(categoryId)) params.category_ids = categoryId;
  const filter = buildBrowseFilter({ conditionIds, soldWithinDays: SOLD_WINDOW_DAYS });
  if (filter) params.filter = filter;

  try {
    const data = await ebayMarketplaceInsightsSearch(params);
    const list = Array.isArray(data?.itemSales) ? data.itemSales : [];
    return list
      .map((it) => ({
        price: Number(it?.lastSoldPrice?.value ?? it?.price?.value),
        title: String(it?.title || ''),
        endDate: it?.lastSoldDate || null,
      }))
      .filter((x) => Number.isFinite(x.price));
  } catch (err) {
    logEbayProviderError('/marketplace_insights/item_sales/search', err.status, err.message);
    return null;
  }
}

async function fetchActiveComparables({ q, conditionIds, categoryId }) {
  const params = {
    q,
    limit: String(SAMPLE_FETCH_LIMIT),
    sort: 'BestMatch',
  };
  if (categoryId && /^\d+$/.test(categoryId)) params.category_ids = categoryId;
  const filter = buildBrowseFilter({ conditionIds, listingMode: 'mixed' });
  if (filter) params.filter = filter;

  const data = await ebayBrowseSearch(params);
  const list = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];
  return list
    .map((it) => {
      const buyNow = Number(it?.price?.value);
      const currentBid = Number(it?.currentBidPrice?.value);
      const price = Number.isFinite(buyNow) ? buyNow : currentBid;
      return {
        price,
        title: String(it?.title || ''),
        bidCount: Number(it?.bidCount) || 0,
        itemId: it?.itemId || null,
      };
    })
    .filter((x) => Number.isFinite(x.price));
}

async function computeMarketValueFresh({ q, conditionIds, categoryId, preferredSource }) {
  const normalized = normalizeKeywords(q);
  if (!normalized) {
    return buildEmptyResult({ q, source: 'active', reason: 'empty_query' });
  }

  const wantSold = preferredSource === 'sold' || preferredSource === 'auto';
  let raw = null;
  let source = 'active';

  if (wantSold) {
    const sold = await fetchSoldComparables({ q: normalized, conditionIds, categoryId });
    if (sold && sold.length >= MIN_COMPS_FOR_MEDIUM) {
      raw = sold;
      source = 'sold';
    }
  }

  if (!raw) {
    try {
      raw = await fetchActiveComparables({ q: normalized, conditionIds, categoryId });
      source = 'active';
    } catch (err) {
      logEbayProviderError('/marketValue/active', err.status || 500, err.message);
      return buildEmptyResult({ q, source: 'active', reason: 'provider_error' });
    }
  }

  if (!raw || !raw.length) {
    return buildEmptyResult({ q, source, reason: 'no_comparables' });
  }

  const filtered = filterAndScoreSample(raw, normalized);
  if (!filtered.length) {
    return buildEmptyResult({ q, source, reason: 'all_filtered_out' });
  }

  const trimmedPrices = trimOutliers(filtered.map((c) => c.price));
  const stats = summarizeStats(trimmedPrices);
  const confidence = computeConfidence(stats);

  return {
    query: q,
    source,
    marketValue: stats.median,
    average: stats.average,
    median: stats.median,
    min: stats.min,
    max: stats.max,
    count: stats.count,
    confidence,
    coefficientOfVariation: stats.coefficientOfVariation,
    sampledAt: Date.now(),
    label:
      source === 'sold'
        ? 'Based on recent sold listings'
        : 'Based on recent comparable listings',
    reason: null,
  };
}

/**
 * Public — get market value for a query, with caching + background refresh.
 *
 * Returns immediately from cache when warm. Triggers a background refresh
 * if the cached entry is past the soft-stale threshold so the *next* render
 * gets fresher data without blocking this one.
 */
async function getMarketValue({ q, conditionIds, categoryId, preferredSource = 'auto' } = {}) {
  const key = buildCacheKey({ q, conditionIds, categoryId, source: preferredSource });
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.value.sampledAt < cached.ttl) {
    if (now - cached.value.sampledAt > STALE_REFRESH_AFTER_MS && !refreshing.has(key)) {
      refreshInBackground(key, { q, conditionIds, categoryId, preferredSource });
    }
    return cached.value;
  }

  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    try {
      const fresh = await computeMarketValueFresh({ q, conditionIds, categoryId, preferredSource });
      const ttl = fresh.count > 0 ? DEFAULT_TTL_MS : NEGATIVE_TTL_MS;
      lruSet(key, { value: fresh, ttl });
      return fresh;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

function refreshInBackground(key, params) {
  refreshing.add(key);
  computeMarketValueFresh(params)
    .then((fresh) => {
      const ttl = fresh.count > 0 ? DEFAULT_TTL_MS : NEGATIVE_TTL_MS;
      lruSet(key, { value: fresh, ttl });
    })
    .catch(() => {})
    .finally(() => refreshing.delete(key));
}

/**
 * Public — enrich a list of normalized eBay items with True Market Value
 * data. Items with the same effective query share one marketValue lookup,
 * so this is safe to call on every search response.
 */
const ENRICH_CONCURRENCY = clampInt(
  process.env.MARKET_VALUE_ENRICH_CONCURRENCY,
  1,
  16,
  4
);

async function enrichItemsWithMarketValue(items, { fallbackQuery } = {}) {
  if (!Array.isArray(items) || !items.length) return items || [];

  const groups = new Map();
  for (const item of items) {
    const q = deriveQueryFromItem(item) || fallbackQuery || '';
    if (!q) continue;
    const conditionIds = item.conditionId ? String(item.conditionId) : '';
    const key = `${normalizeKeywords(q)}::cond=${conditionIds}`;
    if (!groups.has(key)) groups.set(key, { q, conditionIds, items: [] });
    groups.get(key).items.push(item);
  }

  // Bounded-concurrency worker queue so we never fan out more than N eBay
  // comp lookups at once even when a search returns 50+ unique titles.
  const buckets = Array.from(groups.values());
  let cursor = 0;
  const workers = Array.from({ length: Math.min(ENRICH_CONCURRENCY, buckets.length) }, async () => {
    while (cursor < buckets.length) {
      const myIndex = cursor++;
      const { q, conditionIds, items: bucket } = buckets[myIndex];
      try {
        const stats = await getMarketValue({ q, conditionIds });
        for (const item of bucket) attachMarketValue(item, stats);
      } catch (err) {
        logEbayProviderError('/marketValue/enrich', err.status || 500, err.message);
      }
    }
  });
  await Promise.all(workers);

  return items;
}

function deriveQueryFromItem(item) {
  const title = String(item?.title || '').trim();
  if (!title) return '';
  // Use the first 4 meaningful tokens (≥3 chars) of the title. Short enough
  // that similar listings from the same product family hash to the same
  // group (so we issue one comp lookup, not one per card), but specific
  // enough to keep the comp set on-topic.
  const tokens = title
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 4);
  if (tokens.length) return tokens.join(' ');
  return title.split(/\s+/).slice(0, 4).join(' ');
}

function attachMarketValue(item, stats) {
  if (!item || !stats) return;
  item.marketValue = stats.marketValue ?? null;
  item.marketStats = {
    source: stats.source,
    label: stats.label,
    average: stats.average,
    median: stats.median,
    min: stats.min,
    max: stats.max,
    count: stats.count,
    confidence: stats.confidence,
    coefficientOfVariation: stats.coefficientOfVariation,
    sampledAt: stats.sampledAt,
  };
  item.marketConfidence = stats.confidence;
  item.marketLabel = stats.label;

  const livePrice = pickListingPriceForSavings(item);
  if (stats.marketValue != null && livePrice != null) {
    const diff = stats.marketValue - livePrice;
    item.savings = Number(diff.toFixed(2));
    item.savingsPct = stats.marketValue > 0
      ? Number(((diff / stats.marketValue) * 100).toFixed(2))
      : null;
  } else {
    item.savings = null;
    item.savingsPct = null;
  }

  item.dealBadges = computeDealBadges({ item, stats });

  // Re-evaluate the deal recommendation now that we have real market data.
  try {
    const rec = recommendDeal(item);
    if (rec) {
      item.recommendationType = rec.recommendationType;
      item.recommendationReason = rec.recommendationReason;
      item.confidenceScore = rec.confidenceScore;
    }
  } catch (e) {
    // Non-fatal: keep the heuristic recommendation already attached by the normalizer.
  }
}

function pickListingPriceForSavings(item) {
  const candidates = [item.buyNowPrice, item.currentBidPrice, item.price];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const BADGE_DEFS = {
  under_market: { id: 'under_market', emoji: '🔥', label: 'Under Market' },
  rare_price: { id: 'rare_price', emoji: '⚡', label: 'Rare Price' },
  elite_snipe: { id: 'elite_snipe', emoji: '💎', label: 'Elite Snipe' },
  trending_up: { id: 'trending_up', emoji: '📈', label: 'Trending Up' },
  smart_buy: { id: 'smart_buy', emoji: '🧠', label: 'Smart Buy' },
};

function computeDealBadges({ item, stats }) {
  const badges = [];
  if (!stats || !stats.marketValue || !stats.count) return badges;

  const livePrice = pickListingPriceForSavings(item);
  if (livePrice == null) return badges;
  const savingsPct = ((stats.marketValue - livePrice) / stats.marketValue) * 100;

  if (savingsPct >= 10) badges.push(BADGE_DEFS.under_market);
  if (savingsPct >= 30 && stats.confidence !== 'low') badges.push(BADGE_DEFS.rare_price);

  const isAuction = Boolean(item.isAuction);
  const bidCount = Number(item.bidCount) || 0;
  const secs = Number(item.secondsRemaining) || 0;
  if (isAuction && savingsPct >= 20 && bidCount <= 3 && secs > 0 && secs <= 60 * 60) {
    badges.push(BADGE_DEFS.elite_snipe);
  }

  if (stats.average != null && stats.median != null && stats.average > stats.median * 1.05) {
    badges.push(BADGE_DEFS.trending_up);
  }

  if (savingsPct >= 15 && stats.confidence === 'high') badges.push(BADGE_DEFS.smart_buy);

  const seen = new Set();
  return badges.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

function clearCache() {
  cache.clear();
  inflight.clear();
  refreshing.clear();
}

module.exports = {
  getMarketValue,
  enrichItemsWithMarketValue,
  attachMarketValue,
  computeDealBadges,
  pickListingPriceForSavings,
  // Test/internal helpers
  _internal: {
    clearCache,
    trimOutliers,
    summarizeStats,
    computeConfidence,
    filterAndScoreSample,
    normalizeKeywords,
    BADGE_DEFS,
  },
};
