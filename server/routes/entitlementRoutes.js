const express = require('express');
const auth = require('../middleware/auth');
const { getEntitlementByUserId, toMeResponse } = require('../services/premiumEntitlementService');
const { getBestMoveBudget } = require('../services/bestMoveUsageService');
const User = require('../models/User');

const router = express.Router();

router.get('/me', auth, async (req, res, next) => {
  try {
    const ent = await getEntitlementByUserId(req.user._id);
    const user = await User.findById(req.user._id)
      .select(
        'betaTester foundingAccess betaAccessExpiresAt membershipTier premiumTier isPremium premium subscriptionExpires membershipExpiresAt subscription tier plan subscriptionTier referralCodeUsed foundingTesterProgramCompleted bestMoveUsage'
      )
      .lean();
    const payload = toMeResponse(ent, user);
    const bestMove = await getBestMoveBudget(req.user._id);
    return res.json({
      ...payload,
      bestMoveUsage: {
        used: bestMove.used,
        cap: bestMove.cap,
        remaining: bestMove.remaining,
        unlimited: bestMove.unlimited,
        day: bestMove.day,
      },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
