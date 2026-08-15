const express = require('express');
const auth = require('../middleware/auth');
const { getBestMoveBudget, consumeBestMoveCredit } = require('../services/bestMoveUsageService');
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

router.post('/consume', auth, async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
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
