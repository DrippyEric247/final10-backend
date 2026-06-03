/**
 * Client-side request deduping, per-route cooldowns, and global 429 cooling.
 * Used by lib/api.js wrappers for hot endpoints that were hammering Railway.
 */

const COOLDOWN_MS = {
  /** Dedupe rapid /auth/me — not the same as login brute-force protection. */
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
const routeCoolingUntil = new Map();

let globalCoolingUntil = 0;
let authMeBootstrapPending = true;

const listeners = new Set();

export class ApiCoolingDownError extends Error {
  constructor(message = "Cooling down — try again in a minute.") {
    super(message);
    this.name = "ApiCoolingDownError";
    this.status = 429;
    this.isCoolingDown = true;
  }
}

export function getApiCoolingState() {
  const now = Date.now();
  const until = Math.max(globalCoolingUntil, ...routeCoolingUntil.values());
  return {
    isCooling: until > now,
    retryAfterMs: until > now ? until - now : 0,
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

export function markGlobalCooling(retryAfterSec = 60) {
  const ms = Math.max(1000, Number(retryAfterSec) || 60) * 1000;
  globalCoolingUntil = Date.now() + ms;
  notifyCooling();
}

function markRouteCooling(key, retryAfterSec = 60, { affectGlobal = true } = {}) {
  const ms = Math.max(1000, Number(retryAfterSec) || 60) * 1000;
  routeCoolingUntil.set(key, Date.now() + ms);
  if (affectGlobal) {
    markGlobalCooling(retryAfterSec);
  }
}

function isGloballyCooling() {
  return Date.now() < globalCoolingUntil;
}

function isRouteCooling(key) {
  return Date.now() < (routeCoolingUntil.get(key) || 0);
}

/** Call after logout to allow the next session's first /auth/me. */
export function resetAuthMeBootstrap() {
  authMeBootstrapPending = true;
}

/** Normalize axios path or full URL to a stable cooldown key. */
export function cooldownKeyForRequest(method, url = "") {
  const m = String(method || "get").toUpperCase();
  const path = String(url)
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/?api/, "")
    .split("?")[0];

  if (m === "GET" && path === "/auth/me") return "authMe";
  if (m === "POST" && (path === "/auth/login" || path === "/auth/register")) {
    return "authLogin";
  }
  if (m === "GET" && path === "/notifications") return "notifications";
  if (m === "GET" && path === "/levels/me") return "levelsMe";
  if (m === "GET" && (path === "/auctions/daily-tasks" || path === "/actions/daily-tasks")) {
    return "dailyTasks";
  }
  if (m === "GET" && /^\/users\/[^/]+\/ebay(?:-status)?$/.test(path)) return "userEbay";
  if (m === "GET" && path === "/parties/me") return "partiesMe";
  return null;
}

function baseCooldownKey(key) {
  if (!key) return null;
  if (String(key).startsWith("userEbay:")) return "userEbay";
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

  if (isGloballyCooling() && !force && key !== "authLogin") {
    throw new ApiCoolingDownError();
  }
  if (isRouteCooling(coolKey) && !force) {
    throw new ApiCoolingDownError();
  }

  if (key === "authMe" && !force) {
    const minMs = minIntervalForKey("authMe");
    if (!allowBootstrap && authMeBootstrapPending === false) {
      const last = lastSuccessAt.get("authMe") || 0;
      if (Number.isFinite(minMs) && minMs > 0 && Date.now() - last < minMs) {
        throw new ApiCoolingDownError("Profile refresh is on cooldown. Try again shortly.");
      }
    }
  } else if (!force) {
    const minMs = minIntervalForKey(key);
    if (Number.isFinite(minMs) && minMs > 0) {
      const last = lastSuccessAt.get(coolKey) || 0;
      if (Date.now() - last < minMs) {
        throw new ApiCoolingDownError();
      }
    }
  }

  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = (async () => {
    try {
      const result = await run();
      lastSuccessAt.set(coolKey, Date.now());
      if (key === "authMe") {
        authMeBootstrapPending = false;
      }
      return result;
    } catch (err) {
      const status = err?.response?.status ?? err?.status;
      if (status === 429) {
        const retryAfter =
          err?.response?.headers?.["retry-after"] ??
          err?.response?.headers?.["Retry-After"] ??
          err?.retryAfter ??
          60;
        const affectGlobal = coolKey !== "authMe" && coolKey !== "authLogin";
        const routeRetry = coolKey === "authMe" ? Math.min(15, Number(retryAfter) || 15) : retryAfter;
        markRouteCooling(coolKey, routeRetry, { affectGlobal });
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
  routeCoolingUntil.clear();
  globalCoolingUntil = 0;
  authMeBootstrapPending = true;
  listeners.clear();
}
