const { auditFireAndForget } = require('../services/securityAuditService');
const { isProduction } = require('../config/envValidation');

const WINDOW_MS = 60 * 1000;
const WARN_THRESHOLD = 55;
const CRITICAL_THRESHOLD = 120;

/** @type {Map<string, number[]>} */
const buckets = new Map();

function prune(tsList, now) {
  return tsList.filter((t) => now - t < WINDOW_MS);
}

/**
 * Soft guard: audit suspicious bursts; does not block (blocking would need distributed store).
 */
function progressionBurstGuard(req, res, next) {
  const uid = String(req.user?._id || req.user?.id || '');
  if (!uid) return next();
  const now = Date.now();
  let arr = buckets.get(uid) || [];
  arr = prune(arr, now);
  arr.push(now);
  buckets.set(uid, arr);
  if (isProduction() && arr.length >= CRITICAL_THRESHOLD) {
    auditFireAndForget('PROGRESSION_BURST_CRITICAL', {
      userId: req.user._id,
      req,
      meta: { count60s: arr.length },
      severity: 'critical',
    });
  } else if (arr.length >= WARN_THRESHOLD) {
    auditFireAndForget('PROGRESSION_BURST_WARN', {
      userId: req.user._id,
      req,
      meta: { count60s: arr.length },
      severity: 'warn',
    });
  }
  next();
}

module.exports = { progressionBurstGuard };
