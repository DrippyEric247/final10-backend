const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  estimateDealRewardsBatch,
  estimateDealReward,
  markDealRewardClickout,
} = require('../services/dealRewardService');

router.post('/reward-estimate', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const listings = req.body?.listings;
    if (Array.isArray(listings)) {
      const result = await estimateDealRewardsBatch(user, listings);
      return res.json(result);
    }

    const listing = req.body?.listing || req.body;
    const estimate = await estimateDealReward(user, listing);
    return res.json({ estimate });
  } catch (error) {
    console.error('Deal reward estimate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reward-clickout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const listingId = String(req.body?.listingId || '').trim();
    const listing = req.body?.listing || {};
    const result = await markDealRewardClickout(user, { listingId, listing });
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message, code: error.code });
    console.error('Deal reward clickout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
