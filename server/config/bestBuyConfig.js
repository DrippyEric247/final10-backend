/**
 * Best Buy marketplace integration — Phase 1 (server-side only).
 */

function toPositiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const BESTBUY_KEY_ENV_NAMES = ['BESTBUY_API_KEY', 'BBY_API_KEY', 'BEST_BUY_API_KEY'];

function detectBestBuyKeySource() {
  for (const name of BESTBUY_KEY_ENV_NAMES) {
    const raw = String(process.env[name] || '').trim();
    if (raw) return name;
  }
  return null;
}

function getBestBuyApiKey() {
  const source = detectBestBuyKeySource();
  if (!source) return null;
  return String(process.env[source] || '').trim() || null;
}

/** Boot/admin diagnostics — never includes the key value. */
function getBestBuyStartupDiagnostics() {
  const source = detectBestBuyKeySource();
  const apiKeyConfigured = Boolean(source);
  const integrationEnabled = isBestBuyIntegrationEnabled();
  return {
    apiKeyConfigured,
    integrationEnabled,
    keyEnvVar: source,
    expectedEnvVar: 'BESTBUY_API_KEY',
  };
}

function logBestBuyStartupConfig() {
  const diag = getBestBuyStartupDiagnostics();
  // eslint-disable-next-line no-console
  console.log(
    `[BEST_BUY_CONFIG] apiKeyConfigured=${diag.apiKeyConfigured} integrationEnabled=${diag.integrationEnabled} keyEnvVar=${diag.keyEnvVar || 'none'}`
  );
  if (!diag.apiKeyConfigured) {
    // eslint-disable-next-line no-console
    console.warn(
      '[BEST_BUY_CONFIG] Best Buy API disabled — set BESTBUY_API_KEY on the server (never expose to client).'
    );
  }
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
  BESTBUY_KEY_ENV_NAMES,
  detectBestBuyKeySource,
  getBestBuyApiKey,
  isBestBuyIntegrationEnabled,
  getBestBuyConfig,
  getBestBuyStartupDiagnostics,
  logBestBuyStartupConfig,
};
