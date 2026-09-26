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

const SAFE_USER_MESSAGE = 'Best Buy data is temporarily unavailable.';

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

function redactEndpoint(pathWithQuery) {
  return String(pathWithQuery || '')
    .replace(/([?&])apiKey=[^&]*/gi, '$1apiKey=[REDACTED]')
    .slice(0, 512);
}

function extractUpstreamError(body, status) {
  const errObj = body?.error || body?.errors?.[0] || null;
  const message =
    errObj?.message ||
    errObj?.errorDescription ||
    body?.message ||
    body?.errorMessage ||
    null;
  const code = errObj?.code || errObj?.errorCode || body?.code || null;
  if (status === 401 || status === 403) {
    return {
      code: code || 'BESTBUY_UNAUTHORIZED',
      message: message || 'Best Buy API key is invalid or not authorized.',
      userMessage: SAFE_USER_MESSAGE,
    };
  }
  if (status === 404) {
    return {
      code: code || 'BESTBUY_NOT_FOUND',
      message: message || 'Best Buy API endpoint or resource was not found.',
      userMessage: SAFE_USER_MESSAGE,
    };
  }
  if (status === 429) {
    return {
      code: code || 'BESTBUY_RATE_LIMIT',
      message: message || 'Best Buy API rate limit reached.',
      userMessage: SAFE_USER_MESSAGE,
    };
  }
  return {
    code: code || 'BESTBUY_UPSTREAM_ERROR',
    message: message || `Best Buy API returned HTTP ${status}.`,
    userMessage: SAFE_USER_MESSAGE,
  };
}

function bestBuyUnavailableError(code, message, status = 503, extra = {}) {
  return Object.assign(new Error(message), {
    code,
    status,
    provider: 'bestbuy',
    userMessage: extra.userMessage || SAFE_USER_MESSAGE,
    upstreamStatus: extra.upstreamStatus,
    upstreamCode: extra.upstreamCode,
  });
}

function logBestBuyRequestFailed(meta) {
  warn('BESTBUY_REQUEST_FAILED', meta);
}

/**
 * @param {string} pathWithQuery - path starting with /v1 or /beta including query except apiKey
 * @param {{ cacheKind?: string, cacheKeyParts?: string[], skipCache?: boolean, context?: object }} opts
 */
async function bestBuyGet(pathWithQuery, opts = {}) {
  const cfg = getBestBuyConfig();
  const endpoint = redactEndpoint(pathWithQuery);
  const context = opts.context || {};

  if (!cfg.enabled || !cfg.apiKey) {
    const err = bestBuyUnavailableError(
      'BESTBUY_NOT_CONFIGURED',
      'Best Buy integration is not configured on this server. Set BESTBUY_API_KEY.',
      503
    );
    logBestBuyRequestFailed({
      endpoint,
      errorCode: err.code,
      errorMessage: err.message,
      searchQuery: context.searchQuery,
      sku: context.sku,
      cacheStatus: 'skipped',
    });
    throw err;
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
        headers: { Accept: 'application/json', 'User-Agent': 'Final10/1.0 (BestBuy Integration)' },
        signal: controller.signal,
      });
      const text = await res.text();
      const body = safeParseJson(text);

      if (!res.ok) {
        const upstream = extractUpstreamError(body, res.status);
        logBestBuyRequestFailed({
          endpoint,
          upstreamStatus: res.status,
          errorCode: upstream.code,
          errorMessage: upstream.message,
          searchQuery: context.searchQuery,
          sku: context.sku,
          cacheStatus: 'miss',
          responseSnippet: body?._parseFailure ? body.snippet : undefined,
        });
        throw bestBuyUnavailableError(upstream.code, upstream.message, res.status, {
          userMessage: upstream.userMessage,
          upstreamStatus: res.status,
          upstreamCode: upstream.code,
        });
      }

      if (body._parseFailure) {
        logBestBuyRequestFailed({
          endpoint,
          upstreamStatus: res.status,
          errorCode: 'BESTBUY_MALFORMED',
          errorMessage: 'Unreadable JSON from Best Buy API.',
          searchQuery: context.searchQuery,
          sku: context.sku,
          cacheStatus: 'miss',
          responseSnippet: body.snippet,
        });
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
        logBestBuyRequestFailed({
          endpoint,
          upstreamStatus: 504,
          errorCode: 'BESTBUY_TIMEOUT',
          errorMessage: 'Best Buy API request timed out.',
          searchQuery: context.searchQuery,
          sku: context.sku,
          cacheStatus: 'miss',
        });
        throw bestBuyUnavailableError('BESTBUY_TIMEOUT', 'Best Buy API request timed out.', 504);
      }
      if (err.provider === 'bestbuy') throw err;
      logBestBuyRequestFailed({
        endpoint,
        errorCode: 'BESTBUY_UNAVAILABLE',
        errorMessage: err.message,
        searchQuery: context.searchQuery,
        sku: context.sku,
        cacheStatus: 'miss',
      });
      throw bestBuyUnavailableError(
        'BESTBUY_UNAVAILABLE',
        SAFE_USER_MESSAGE,
        503
      );
    } finally {
      clearTimeout(timer);
    }
  })();

  inflight.set(cKey, run);
  try {
    const data = await run;
    info('BESTBUY_REQUEST_OK', { endpoint, cacheKind, cacheKey: cKey });
    return { data, cache: { hit: false, key: cKey } };
  } finally {
    inflight.delete(cKey);
  }
}

module.exports = {
  bestBuyGet,
  bestBuyUnavailableError,
  SAFE_USER_MESSAGE,
  redactEndpoint,
};
