/**
 * Best Buy REST client — server-side only. Never log or return the API key.
 */
function getFetchImpl() {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }
  const fetchModule = require('node-fetch');
  return fetchModule.default || fetchModule;
}
const { getBestBuyConfig } = require('../../config/bestBuyConfig');
const { warn, info } = require('../structuredLog');
const { remember, recall, cacheKey } = require('./bestBuyCache');

const inflight = new Map();
const requestTimestamps = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneRateWindow() {
  const cutoff = Date.now() - 60_000;
  while (requestTimestamps.length && requestTimestamps[0] < cutoff) {
    requestTimestamps.shift();
  }
}

async function waitForRateLimitSlot() {
  const { maxRequestsPerMinute } = getBestBuyConfig();
  pruneRateWindow();
  if (requestTimestamps.length < maxRequestsPerMinute) return;
  const waitMs = Math.max(250, requestTimestamps[0] + 60_000 - Date.now());
  await sleep(waitMs);
  pruneRateWindow();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { _parseFailure: true, snippet: String(text || '').slice(0, 400) };
  }
}

function bestBuyUnavailableError(code, message, status = 503) {
  return Object.assign(new Error(message), { code, status, provider: 'bestbuy' });
}

/**
 * @param {string} pathWithQuery - path starting with /v1 or /beta including query except apiKey
 * @param {{ cacheKind?: string, cacheKeyParts?: string[], skipCache?: boolean }} opts
 */
async function bestBuyGet(pathWithQuery, opts = {}) {
  const cfg = getBestBuyConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    throw bestBuyUnavailableError(
      'BESTBUY_NOT_CONFIGURED',
      'Best Buy integration is not configured on this server.'
    );
  }

  const cacheKind = opts.cacheKind || 'search';
  const cKey =
    opts.cacheKeyParts && opts.cacheKeyParts.length
      ? cacheKey(opts.cacheKeyParts)
      : cacheKey([cacheKind, pathWithQuery]);

  if (!opts.skipCache) {
    const cached = recall(cKey);
    if (cached.hit) {
      return { data: cached.payload, cache: { hit: true, key: cKey } };
    }
  }

  if (inflight.has(cKey)) {
    const data = await inflight.get(cKey);
    return { data, cache: { hit: true, key: cKey, deduped: true } };
  }

  const run = (async () => {
    await waitForRateLimitSlot();
    requestTimestamps.push(Date.now());

    const separator = pathWithQuery.includes('?') ? '&' : '?';
    const url = `${cfg.baseUrl}${pathWithQuery}${separator}apiKey=${encodeURIComponent(cfg.apiKey)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.fetchTimeoutMs);

    try {
      const fetchImpl = getFetchImpl();
      const res = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await res.text();
      const body = safeParseJson(text);

      if (res.status === 429) {
        throw bestBuyUnavailableError(
          'BESTBUY_RATE_LIMIT',
          'Best Buy API rate limit reached. Try again shortly.',
          429
        );
      }
      if (res.status === 403) {
        throw bestBuyUnavailableError(
          'BESTBUY_FORBIDDEN',
          'Best Buy API access denied.',
          403
        );
      }
      if (!res.ok) {
        throw bestBuyUnavailableError(
          'BESTBUY_UPSTREAM_ERROR',
          `Best Buy API returned ${res.status}.`,
          res.status
        );
      }
      if (body._parseFailure) {
        throw bestBuyUnavailableError(
          'BESTBUY_MALFORMED',
          'Best Buy API returned an unreadable response.',
          502
        );
      }

      remember(cKey, body, cacheKind);
      return body;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw bestBuyUnavailableError('BESTBUY_TIMEOUT', 'Best Buy API request timed out.', 504);
      }
      if (err.provider === 'bestbuy') throw err;
      warn('BESTBUY_REQUEST_FAILED', { message: err.message });
      throw bestBuyUnavailableError(
        'BESTBUY_UNAVAILABLE',
        'Best Buy marketplace data is temporarily unavailable.',
        503
      );
    } finally {
      clearTimeout(timer);
    }
  })();

  inflight.set(cKey, run);
  try {
    const data = await run;
    info('BESTBUY_REQUEST_OK', { cacheKey: cKey, cacheKind });
    return { data, cache: { hit: false, key: cKey } };
  } finally {
    inflight.delete(cKey);
  }
}

module.exports = {
  bestBuyGet,
  bestBuyUnavailableError,
};
