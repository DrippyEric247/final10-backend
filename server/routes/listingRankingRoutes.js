const express = require('express');
const auth = require('../middleware/auth');
const { rankListings } = require('../services/listingRankingService');
const { getEntitlementByUserId } = require('../services/premiumEntitlementService');
const { resolveUserEntitlements } = require('../services/userEntitlementService');
const User = require('../models/User');
const { HttpError } = require('../middleware/apiErrors');

const router = express.Router();

function tierBoostForPlan(effectivePlan) {
  const plan = String(effectivePlan || 'free').toLowerCase();
  if (plan === 'pro' || plan === 'elite') return 22;
  if (plan === 'premium' || plan === 'core') return 10;
  return 0;
}

/** POST /api/listings/rank — server-authoritative ranking for authenticated users. */
router.post('/rank', auth, async (req, res, next) => {
  try {
    const listings = Array.isArray(req.body?.listings) ? req.body.listings : [];
    if (listings.length > 100) {
      return next(new HttpError(400, 'LISTINGS_TOO_LARGE', 'Maximum 100 listings per rank request.'));
    }

    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).lean();
    const entitlementDoc = await getEntitlementByUserId(userId);
    const resolved = resolveUserEntitlements(user, entitlementDoc);
    const tierBoost = tierBoostForPlan(resolved.effectivePlan);

    const ranked = rankListings(listings, { tierBoost, effectivePlan: resolved.effectivePlan });

    return res.json({
      ok: true,
      effectivePlan: resolved.effectivePlan,
      tierBoostApplied: tierBoost,
      results: ranked,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
