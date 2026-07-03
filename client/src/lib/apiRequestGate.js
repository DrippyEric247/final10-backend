/**
 * Client-side request deduping, per-route spacing, and server 429 backoff.
 * Client spacing waits silently — only real HTTP 429 triggers user-visible cooling.
 */

import { parseRetryAfterSec, sleepMs } from './parseRetryAfter';
import { RATE_LIMIT_MAX_ATTEMPTS } from './apiRateLimitBackoff';
import { SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE } from './savvyScoutRateLimitCopy';

const COOLDOWN_MS = {
  /** Minimum spacing between successful /auth/me refreshes (not login brute-force). */
  authMe: 45_000,
  authLogin: 3_000,
  notifications: 60_000,
  levelsMe: 60_000,
  dailyTasks: 5 * 60_000,
  userEbay: 2 * 60_000,
  partiesMe: 60_000,
};

const inflight = new Map();
const lastSuccessAt = new Map();
const lastResult = new Map();
const routeCoolingUntil = new Map();

/** Set only from real HTTP 429 responses (see markServerRateLimit). */
let serverRateLimitUntil = 0;
let lastRateLimitMeta = null;
/** @type {'idle' | 'updating' | 'failed'} */
let rateLimitUiPhase = 'idle';
let rateLimitAttempt = 0;
let lastFailedRequestConfig = null;
let manualRetryRunner = null;
let authMeBootstrapPending = true;

const listeners = new Set();

export class ApiCoolingDownError extends Error {
  constructor(message = SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE) {
    super(message);
    this.name = 'ApiCoolingDownError';
    this.status = 429;
    this.isCoolingDown = true;
    this.isRateLimited = true;
  }
}

export function getLastRateLimitMeta() {
  return lastRateLimitMeta;
}

export function getApiCoolingState() {
  const now = Date.now();
  const until = serverRateLimitUntil;
  const isCooling = until > now || rateLimitUiPhase === 'updating' || rateLimitUiPhase === 'failed';
  return {
    isCooling,
    phase: rateLimitUiPhase,
    isUpdating: rateLimitUiPhase === 'updating',
    isFailed: rateLimitUiPhase === 'failed',
    retryAfterMs: until > now ? until - now : 0,
    attempt: rateLimitAttempt,
    maxAttempts: RATE_LIMIT_MAX_ATTEMPTS,
    canManualRetry: rateLimitUiPhase === 'failed' && Boolean(manualRetryRunner || lastFailedRequestConfig),
  };
}

export function subscribeApiCooling(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyCooling() {
  const state = getApiCoolingState();
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* ignore */
    }
  });
}

/** Record a server HTTP 429 — drives Savvy Scout updating card. */
export function markServerRateLimit(retryAfterSec, meta = {}, { attempt = 1, phase = 'updating' } = {}) {
  const ms = Math.max(1000, parseRetryAfterSec(null, retryAfterSec) * 1000);
  serverRateLimitUntil = Date.now() + ms;
  lastRateLimitMeta = {
    ...meta,
    retryAfterSec: Math.ceil(ms / 1000),
    at: Date.now(),
  };
  rateLimitUiPhase = phase;
  rateLimitAttempt = attempt;
  notifyCooling();
}

export function registerRateLimitFailedRequest(config, retryRunner) {
  lastFailedRequestConfig = config || null;
  manualRetryRunner = typeof retryRunner === 'function' ? retryRunner : null;
  rateLimitUiPhase = 'failed';
  notifyCooling();
}

export function clearRateLimitRecovery() {
  serverRateLimitUntil = 0;
  lastRateLimitMeta = null;
  rateLimitUiPhase = 'idle';
  rateLimitAttempt = 0;
  lastFailedRequestConfig = null;
  manualRetryRunner = null;
  notifyCooling();
}

/**
 * Manual retry from Savvy Scout card after backoff exhausted.
 * @returns {Promise<boolean>} true if recovery succeeded
 */
export async function manualRateLimitRetry() {
  if (!manualRetryRunner && !lastFailedRequestConfig) return false;
  rateLimitUiPhase = 'updating';
  rateLimitAttempt = 0;
  notifyCooling();
  try {
    if (manualRetryRunner) {
      await manualRetryRunner();
    }
    clearRateLimitRecovery();
    return true;
  } catch {
    rateLimitUiPhase = 'failed';
    notifyCooling();
    return false;
  }
}

/** @deprecated use markServerRateLimit */
export function markGlobalCooling(retryAfterSec = 60) {
  markServerRateLimit(retryAfterSec, { source: 'legacy_markGlobalCooling' });
}

function markRouteCooling(key, retryAfterSec = 60) {
  const ms = Math.max(1000, parseRetryAfterSec(null, retryAfterSec) * 1000);
  routeCoolingUntil.set(key, Date.now() + ms);
}

async function waitUntilServerAllowed() {
  const wait = serverRateLimitUntil - Date.now();
  if (wait > 0) {
    await sleepMs(wait);
  }
}

async function waitUntilRouteAllowed(key) {
  const until = routeCoolingUntil.get(key) || 0;
  const wait = until - Date.now();
  if (wait > 0) {
    await sleepMs(wait);
  }
}

async function waitForMinInterval(key, coolKey, { allowBootstrap = false } = {}) {
  if (key === 'authMe' && !allowBootstrap && authMeBootstrapPending === false) {
    const minMs = minIntervalForKey('authMe');
    const last = lastSuccessAt.get('authMe') || 0;
    const elapsed = Date.now() - last;
    if (Number.isFinite(minMs) && minMs > 0 && elapsed < minMs) {
      await sleepMs(minMs - elapsed);
    }
    return;
  }

  const minMs = minIntervalForKey(key);
  if (!Number.isFinite(minMs) || minMs <= 0) return;
  const last = lastSuccessAt.get(coolKey) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < minMs) {
    await sleepMs(minMs - elapsed);
  }
}

/** Call after logout to allow the next session's first /auth/me. */
export function resetAuthMeBootstrap() {
  authMeBootstrapPending = true;
}

/** Normalize axios path or full URL to a stable cooldown key. */
export function cooldownKeyForRequest(method, url = '') {
  const m = String(method || 'get').toUpperCase();
  const path = String(url)
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/?api/, '')
    .split('?')[0];

  if (m === 'GET' && path === '/auth/me') return 'authMe';
  if (m === 'POST' && (path === '/auth/login' || path === '/auth/register')) {
    return 'authLogin';
  }
  if (m === 'GET' && path === '/notifications') return 'notifications';
  if (m === 'GET' && path === '/levels/me') return 'levelsMe';
  if (m === 'GET' && (path === '/auctions/daily-tasks' || path === '/actions/daily-tasks')) {
    return 'dailyTasks';
  }
  if (m === 'GET' && /^\/users\/[^/]+\/ebay(?:-status)?$/.test(path)) return 'userEbay';
  if (m === 'GET' && path === '/parties/me') return 'partiesMe';
  return null;
}

function baseCooldownKey(key) {
  if (!key) return null;
  if (String(key).startsWith('userEbay:')) return 'userEbay';
  return key;
}

function minIntervalForKey(key) {
  const base = baseCooldownKey(key);
  if (!base) return 0;
  const ms = COOLDOWN_MS[base];
  return ms === Infinity ? Infinity : Number(ms) || 0;
}

/**
 * @param {string} key
 * @param {() => Promise<T>} run
 * @param {{ force?: boolean, allowBootstrap?: boolean }} [opts]
 */
export async function gatedRequest(key, run, opts = {}) {
  const { force = false, allowBootstrap = false } = opts;
  const coolKey = baseCooldownKey(key) || key;

  if (!key) {
    return run();
  }

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = (async () => {
    if (!force) {
      await waitUntilServerAllowed();
      await waitUntilRouteAllowed(coolKey);
      await waitForMinInterval(key, coolKey, { allowBootstrap });
    }

    try {
      const result = await run();
      lastSuccessAt.set(coolKey, Date.now());
      lastResult.set(key, result);
      if (key === 'authMe') {
        authMeBootstrapPending = false;
      }
      return result;
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      if (status === 429) {
        const headers = err?.response?.headers;
        const retryAfter = parseRetryAfterSec(headers, err?.retryAfter ?? 60);
        const path = String(err?.config?.url || '').split('?')[0];
        markServerRateLimit(retryAfter, {
          path,
          method: err?.config?.method,
          key: coolKey,
        }, { attempt: 1, phase: 'updating' });
        markRouteCooling(coolKey, coolKey === 'authMe' ? Math.min(15, retryAfter) : retryAfter);
        await sleepMs(retryAfter * 1000);
        try {
          const retryResult = await run();
          clearRateLimitRecovery();
          lastSuccessAt.set(coolKey, Date.now());
          lastResult.set(key, retryResult);
          if (key === 'authMe') {
            authMeBootstrapPending = false;
          }
          return retryResult;
        } catch (retryErr) {
          if (retryErr?.response?.status === 429 || retryErr?.status === 429) {
            registerRateLimitFailedRequest(err?.config);
            throw new ApiCoolingDownError();
          }
          throw retryErr;
        }
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function resetApiRequestGateForTests() {
  inflight.clear();
  lastSuccessAt.clear();
  lastResult.clear();
  routeCoolingUntil.clear();
  clearRateLimitRecovery();
  authMeBootstrapPending = true;
  listeners.clear();
}
