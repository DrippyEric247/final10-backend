/**
 * Parse Retry-After (seconds or HTTP-date) and RateLimit-Reset from response headers.
 * @param {Record<string, string|number|undefined>|import('axios').AxiosResponseHeaders} [headers]
 * @param {number} [fallback=60]
 * @returns {number} seconds until retry (1–3600)
 */
export function parseRetryAfterSec(headers, fallback = 60) {
  if (!headers || typeof headers !== 'object') {
    return clampRetrySec(fallback);
  }

  const retryRaw =
    headers['retry-after'] ??
    headers['Retry-After'] ??
    headers.get?.('retry-after');

  if (retryRaw != null && retryRaw !== '') {
    const asNum = Number(retryRaw);
    if (Number.isFinite(asNum) && asNum >= 0) {
      return clampRetrySec(asNum);
    }
    const dateMs = Date.parse(String(retryRaw));
    if (Number.isFinite(dateMs)) {
      return clampRetrySec(Math.ceil((dateMs - Date.now()) / 1000));
    }
  }

  const resetRaw =
    headers['ratelimit-reset'] ??
    headers['RateLimit-Reset'] ??
    headers.get?.('ratelimit-reset');

  if (resetRaw != null && resetRaw !== '') {
    const resetSec = Number(resetRaw);
    if (Number.isFinite(resetSec) && resetSec > 0) {
      const waitMs = resetSec * 1000 - Date.now();
      if (waitMs > 0) {
        return clampRetrySec(Math.ceil(waitMs / 1000));
      }
    }
  }

  return clampRetrySec(fallback);
}

function clampRetrySec(n) {
  const sec = Math.ceil(Number(n) || 60);
  return Math.min(3600, Math.max(1, sec));
}

export function sleepMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}
