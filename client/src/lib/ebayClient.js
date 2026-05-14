/**
 * Client-side retries + readable messages for marketplace (/ebay/*) calls via axios `api`.
 */
import { api } from "./api";
import { parseApiError } from "./apiErrorParsing";

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 550;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextDelayMs(attempt, retryAfterSec) {
  const ra =
    Number.isFinite(Number(retryAfterSec)) && Number(retryAfterSec) > 0 && Number(retryAfterSec) < 120
      ? Number(retryAfterSec) * 1000
      : null;
  if (ra != null) return ra;
  return Math.min(8000, BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250));
}

export function ebayFriendlyMessage(error, fallback = "Marketplace request failed. Try again shortly.") {
  const { status, code, message } = parseApiError(error);
  if (status === 429 || code === "RATE_LIMIT" || code === "RATE_LIMITED") {
    return (
      message ||
      "Too many marketplace requests right now. Please wait a minute and try again."
    );
  }
  if (status === 503 || status === 502 || status === 504) {
    return (
      message ||
      "The marketplace is temporarily busy. Please retry in a few moments."
    );
  }
  if (status === 401) {
    return message || "Please sign in again to load marketplace results.";
  }
  if (message && typeof message === "string") return message;
  return fallback;
}

async function getWithRetry(path, config = {}) {
  let lastErr;
  const attempts = MAX_ATTEMPTS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await api.get(path, config);
      return res.data;
    } catch (e) {
      lastErr = e;
      const status = e.response?.status;
      const retryAfter = parseInt(e.response?.headers?.["retry-after"], 10);
      const retryable = status === 429 || status >= 500;
      if (!retryable || attempt >= attempts - 1) throw e;
      await sleep(nextDelayMs(attempt, retryAfter));
    }
  }
  throw lastErr;
}

export async function fetchEbaySearch(params, axiosConfig = {}) {
  return getWithRetry("/ebay/search", { ...axiosConfig, params });
}

export async function fetchEbayFinal10(params, axiosConfig = {}) {
  return getWithRetry("/ebay/final10", { ...axiosConfig, params });
}

export async function fetchEbayTrending(category = "all", limit = 20, axiosConfig = {}) {
  return getWithRetry("/ebay/trending", {
    ...axiosConfig,
    params: { category, limit },
  });
}
