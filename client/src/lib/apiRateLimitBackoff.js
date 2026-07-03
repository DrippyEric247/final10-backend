/** Exponential backoff helpers for background 429 recovery. */

export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_BACKOFF_BASE_MS = 1000;
export const RATE_LIMIT_BACKOFF_MAX_MS = 32000;

/**
 * @param {number} attempt 0-based attempt index
 * @param {number} [retryAfterSec] server Retry-After hint
 */
export function rateLimitBackoffMs(attempt, retryAfterSec) {
  const serverMs =
    Number.isFinite(Number(retryAfterSec)) && Number(retryAfterSec) > 0
      ? Number(retryAfterSec) * 1000
      : 0;
  const exp = Math.min(
    RATE_LIMIT_BACKOFF_MAX_MS,
    RATE_LIMIT_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt)
  );
  const jitter = Math.floor(Math.random() * 200);
  return Math.max(serverMs, exp) + jitter;
}
