/**
 * Counts only successful live marketplace scans (external Browse API + results).
 * Failed, mock, stale-cache, and empty responses do not consume budget.
 */

const {
  isBetaMode,
  getLiveScanCap,
  getLiveScanAbuseCap,
} = require('../config/betaMode');

const WINDOW_MS = 60 * 1000;
const buckets = new Map();

function bucketKey(req) {
  const uid = req?.user?._id || req?.user?.id;
  if (uid) return `user:${uid}`;
  return `ip:${String(req?.ip || 'anon')}`;
}

function readBucket(key, now = Date.now()) {
  const row = buckets.get(key);
  if (!row || now - row.windowStart >= WINDOW_MS) {
    return { windowStart: now, count: 0 };
  }
  return row;
}

function writeBucket(key, row) {
  buckets.set(key, row);
  if (buckets.size > 5000) {
    const cutoff = Date.now() - WINDOW_MS * 2;
    for (const [k, v] of buckets.entries()) {
      if (v.windowStart < cutoff) buckets.delete(k);
    }
  }
}

function getSoftBusyMessage() {
  return isBetaMode()
    ? 'Savvy Scout is checking for fresh deals — try again in a moment.'
    : 'Too many marketplace searches right now. Please wait about a minute, then try again.';
}

function logAbuseProtection(req, detail) {
  const payload = {
    at: new Date().toISOString(),
    key: bucketKey(req),
    userId: req?.user?._id ? String(req.user._id) : null,
    ip: req?.ip || null,
    path: req?.originalUrl || req?.url || null,
    betaMode: isBetaMode(),
    ...detail,
  };
  console.warn('[betaMode] marketplace abuse protection triggered', payload);
}

/**
 * @returns {{ allowed: boolean, remaining: number, cap: number, abuse: boolean }}
 */
function peekLiveScanBudget(req) {
  const key = bucketKey(req);
  const cap = getLiveScanCap();
  const abuseCap = getLiveScanAbuseCap();
  const row = readBucket(key);
  const effectiveCap = Math.min(abuseCap, cap);
  const allowed = row.count < effectiveCap;
  return {
    allowed,
    remaining: Math.max(0, effectiveCap - row.count),
    cap: effectiveCap,
    abuse: row.count >= abuseCap,
    count: row.count,
    key,
  };
}

/**
 * Block before calling the external marketplace API when budget is exhausted.
 */
function assertLiveScanAllowed(req, res) {
  const peek = peekLiveScanBudget(req);
  if (peek.allowed) return true;

  logAbuseProtection(req, {
    reason: 'pre_scan_budget_exhausted',
    count: peek.count,
    cap: peek.cap,
    abuse: peek.abuse,
  });

  const status = isBetaMode() ? 503 : 429;
  res.status(status).json({
    success: false,
    code: isBetaMode() ? 'MARKETPLACE_BUSY' : 'RATE_LIMIT',
    message: getSoftBusyMessage(),
    items: [],
    final10: [],
    pagination: null,
    retryAfterSec: 60,
  });
  return false;
}

/**
 * Record a successful live external scan. Call only after Browse API returns real data.
 * @param {{ liveExternal?: boolean, mock?: boolean, itemCount?: number }} meta
 */
function recordLiveScanSuccess(req, meta = {}) {
  const liveExternal = Boolean(meta.liveExternal);
  const mock = Boolean(meta.mock);
  const itemCount = Number(meta.itemCount) || 0;

  if (!liveExternal || mock || itemCount <= 0) {
    return { counted: false, peek: peekLiveScanBudget(req) };
  }

  const key = bucketKey(req);
  const now = Date.now();
  const row = readBucket(key, now);
  row.count += 1;
  writeBucket(key, row);

  const peek = peekLiveScanBudget(req);
  if (!peek.allowed) {
    logAbuseProtection(req, {
      reason: 'post_scan_budget_exhausted',
      count: row.count,
      cap: peek.cap,
      abuse: peek.abuse,
    });
  }

  return { counted: true, peek };
}

/** No-op pass-through — counting happens around external API calls only. */
function marketplaceScanRouteGate(_req, _res, next) {
  next();
}

function resetMarketplaceScanBucketsForTests() {
  buckets.clear();
}

module.exports = {
  assertLiveScanAllowed,
  recordLiveScanSuccess,
  peekLiveScanBudget,
  marketplaceScanRouteGate,
  getSoftBusyMessage,
  logAbuseProtection,
  resetMarketplaceScanBucketsForTests,
};
