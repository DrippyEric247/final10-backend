/**
 * Best Buy marketplace integration — Phase 1 (server-side only).
 */

function toPositiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getBestBuyApiKey() {
  const key = String(process.env.BESTBUY_API_KEY || process.env.BBY_API_KEY || '').trim();
  return key || null;
}

function isBestBuyIntegrationEnabled() {
  if (String(process.env.BESTBUY_INTEGRATION_ENABLED || '').toLowerCase() === 'false') {
    return false;
  }
  return Boolean(getBestBuyApiKey());
}

function getBestBuyConfig() {
  return {
    apiKey: getBestBuyApiKey(),
    enabled: isBestBuyIntegrationEnabled(),
    baseUrl: String(process.env.BESTBUY_API_BASE_URL || 'https://api.bestbuy.com').replace(/\/$/, ''),
    searchCacheTtlMs: toPositiveInt(process.env.BESTBUY_SEARCH_CACHE_TTL_MS, 10 * 60 * 1000),
    productCacheTtlMs: toPositiveInt(process.env.BESTBUY_PRODUCT_CACHE_TTL_MS, 30 * 60 * 1000),
    openBoxCacheTtlMs: toPositiveInt(process.env.BESTBUY_OPENBOX_CACHE_TTL_MS, 3 * 60 * 1000),
    maxRequestsPerMinute: toPositiveInt(process.env.BESTBUY_MAX_REQUESTS_PER_MINUTE, 60),
    fetchTimeoutMs: toPositiveInt(process.env.BESTBUY_FETCH_TIMEOUT_MS, 12000),
    defaultPageSize: Math.min(25, toPositiveInt(process.env.BESTBUY_DEFAULT_PAGE_SIZE, 10)),
  };
}

module.exports = {
  getBestBuyApiKey,
  isBestBuyIntegrationEnabled,
  getBestBuyConfig,
};
