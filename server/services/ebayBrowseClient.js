/**
 * eBay Browse API GET with retries, backoff, and safe human-readable errors.
 */
const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const { getEbayAppToken } = require('./ebayAuthService');

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 450;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt, retryAfterSec) {
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0 && retryAfterSec <= 120) {
    return Math.round(retryAfterSec * 1000);
  }
  const exp = BASE_DELAY_MS * 2 ** attempt;
  return Math.min(8000, exp + Math.floor(Math.random() * 220));
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { _parseFailure: true, snippet: String(text || '').slice(0, 400) };
  }
}

/**
 * Map eBay / HTTP status to a single safe sentence for API JSON `message`.
 */
function messageForStatus(status, body) {
  const first =
    body?.errors?.[0]?.message ||
    body?.errorMessage ||
    body?.message ||
    body?.error?.[0]?.longMessage ||
    body?.error?.[0]?.message;

  if (status === 429) {
    return 'Market search is rate-limited right now. Please wait a short moment and try again.';
  }
  if (status === 401 || status === 403) {
    return 'Marketplace access could not be authorized. Try again in a minute.';
  }
  if (status >= 500) {
    return 'The marketplace is temporarily unavailable. Please try again shortly.';
  }
  if (typeof first === 'string' && first.length > 0 && first.length < 220) {
    return first;
  }
  return 'Market results could not be loaded.';
}

/**
 * GET Buy Browse JSON with retries on 429 and 5xx.
 * @param {string} path - relative to buy/browse/v1 (e.g. item_summary/search)
 * @param {Record<string, string|number>} params - query params
 */
async function ebayBrowseGet(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = query
    ? `https://api.ebay.com/buy/browse/v1/${path}?${query}`
    : `https://api.ebay.com/buy/browse/v1/${path}`;

  let lastErr;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const token = await getEbayAppToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    const data = safeParseJson(text);

    if (response.ok) {
      return data;
    }

    const retryAfterSec = parseInt(response.headers.get('retry-after'), 10);
    const msg = messageForStatus(response.status, data);
    const err = Object.assign(new Error(msg), {
      status: response.status,
      code: `EBAY_HTTP_${response.status}`,
      ebayBody: data,
    });
    lastErr = err;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= MAX_ATTEMPTS - 1) {
      throw err;
    }

    await sleep(backoffMs(attempt, retryAfterSec));
  }

  throw lastErr;
}

module.exports = { ebayBrowseGet, messageForStatus };
