const express = require('express');
const auth = require('../middleware/auth');
const { getEntitlementByUserId, toMeResponse } = require('../services/premiumEntitlementService');
const User = require('../models/User');

const router = express.Router();

router.get('/me', auth, async (req, res, next) => {
  try {
    const ent = await getEntitlementByUserId(req.user._id);
    const user = await User.findById(req.user._id)
      .select('betaTester foundingAccess betaAccessExpiresAt')
      .lean();
    return res.json(toMeResponse(ent, user));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
