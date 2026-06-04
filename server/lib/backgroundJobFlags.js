/**
 * Background job toggles — set in Railway/env while debugging API routes.
 *
 * DISABLE_SAVVY_SCOUT_SCAN=true     — stops 5-min Savvy Scout eBay sweeps (recommended while debugging owner panel)
 * DISABLE_AUCTION_CRON_REFRESH=true — stops 30-min auction aggregator refresh
 * EBAY_VERBOSE_LOG=true             — full eBay success/failure console logs (default off)
 * EBAY_LOG_THROTTLE_MS=300000       — min ms between identical EBAY_PROVIDER_ERROR logs (default 5 min)
 */

function envFlag(name) {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

function isSavvyScoutBackgroundScanEnabled() {
  return !envFlag('DISABLE_SAVVY_SCOUT_SCAN');
}

function isAuctionCronRefreshEnabled() {
  return !envFlag('DISABLE_AUCTION_CRON_REFRESH');
}

function isEbayVerboseLogEnabled() {
  return envFlag('EBAY_VERBOSE_LOG');
}

function ebayLogThrottleMs() {
  const n = Number(process.env.EBAY_LOG_THROTTLE_MS);
  return Number.isFinite(n) && n >= 0 ? n : 300000;
}

module.exports = {
  isSavvyScoutBackgroundScanEnabled,
  isAuctionCronRefreshEnabled,
  isEbayVerboseLogEnabled,
  ebayLogThrottleMs,
};
