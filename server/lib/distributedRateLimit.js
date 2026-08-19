/**
 * Mongo-backed shared rate limit counters (multi-replica safe).
 */

const DistributedRateLimitBucket = require('../models/DistributedRateLimitBucket');
const mongoose = require('mongoose');
const { isProduction } = require('../config/envValidation');

function windowStartFor(nowMs, windowMs) {
  return new Date(Math.floor(nowMs / windowMs) * windowMs);
}

async function incrementDistributedRateLimit(bucketKey, max, windowMs) {
  const key = String(bucketKey || '').trim();
  const limit = Math.max(1, Math.round(Number(max) || 1));
  const win = Math.max(1000, Math.round(Number(windowMs) || 60000));
  const now = Date.now();
  const windowStart = windowStartFor(now, win);
  const expiresAt = new Date(windowStart.getTime() + win + 120000);

  const doc = await DistributedRateLimitBucket.findOneAndUpdate(
    { bucketKey: key, windowStart },
    {
      $inc: { count: 1 },
      $setOnInsert: { windowMs: win, expiresAt },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const allowed = doc.count <= limit;
  const resetTime = new Date(windowStart.getTime() + win);
  const retryAfterSec = Math.max(1, Math.ceil((resetTime.getTime() - now) / 1000));

  return {
    allowed,
    count: doc.count,
    limit,
    remaining: Math.max(0, limit - doc.count),
    retryAfterSec,
    resetTime,
  };
}

function useDistributedRateLimits() {
  return isProduction() && mongoose.connection.readyState === 1;
}

/**
 * Express middleware — SECURITY / ABUSE limits shared across replicas.
 */
function distributedRateLimitMiddleware({
  name,
  windowMs,
  max,
  keyGenerator = (req) => req.ip || 'anon',
  message = 'Too many requests. Try again later.',
  category = 'SECURITY',
}) {
  return async function distributedRateLimit(req, res, next) {
    if (!useDistributedRateLimits()) {
      return next();
    }
    try {
      const rawKey = keyGenerator(req);
      const bucketKey = `${category}:${name}:${rawKey}`;
      const cap = typeof max === 'function' ? max(req) : max;
      const result = await incrementDistributedRateLimit(bucketKey, cap, windowMs);
      res.setHeader('RateLimit-Limit', String(result.limit));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSec));
        return res.status(429).json({
          code: 'RATE_LIMIT',
          message: typeof message === 'string' ? message : message?.message || 'Rate limited.',
          requestId: req.requestId || undefined,
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  incrementDistributedRateLimit,
  useDistributedRateLimits,
  distributedRateLimitMiddleware,
  windowStartFor,
};
