const express = require('express');
const auth = require('../middleware/auth');
const { getBestMoveBudget, consumeBestMoveCredit } = require('../services/bestMoveUsageService');
const { bestMoveConsumeLimiter } = require('../middleware/rateLimits');
const { HttpError } = require('../middleware/apiErrors');

const router = express.Router();

router.get('/usage', auth, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const budget = await getBestMoveBudget(userId);
    return res.json({
      used: budget.used,
      cap: budget.cap,
      remaining: budget.remaining,
      unlimited: budget.unlimited,
      effectivePlan: budget.effectivePlan,
      day: budget.day,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/consume', auth, bestMoveConsumeLimiter, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    // Ignore client-supplied quota/plan spoof fields — server resolves entitlements only.
    if (
      req.body &&
      (req.body.plan != null ||
        req.body.remaining != null ||
        req.body.cap != null ||
        req.body.used != null)
    ) {
      const { auditFireAndForget } = require('../services/securityAuditService');
      auditFireAndForget('BEST_MOVE_SPOOF_IGNORED', {
        userId,
        meta: {
          keys: Object.keys(req.body || {}).filter((k) =>
            ['plan', 'remaining', 'cap', 'used', 'effectivePlan'].includes(k)
          ),
        },
        severity: 'warn',
      });
    }

    const result = await consumeBestMoveCredit(userId);
    if (!result.ok) {
      return next(
        new HttpError(429, result.code || 'BEST_MOVE_LIMIT_REACHED', 'Daily Best Move limit reached.', {
          used: result.used,
          cap: result.cap,
          remaining: result.remaining,
          effectivePlan: result.effectivePlan,
        })
      );
    }
    return res.json({
      ok: true,
      used: result.used,
      cap: result.cap,
      remaining: result.remaining,
      unlimited: Boolean(result.unlimited),
      effectivePlan: result.effectivePlan,
      day: result.day,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
