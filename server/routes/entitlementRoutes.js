const express = require('express');
const auth = require('../middleware/auth');
const { getEntitlementByUserId, toMeResponse } = require('../services/premiumEntitlementService');

const router = express.Router();

router.get('/me', auth, async (req, res, next) => {
  try {
    const ent = await getEntitlementByUserId(req.user._id);
    return res.json(toMeResponse(ent));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
