const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { resolveSavvyMultiplierState } = require('../services/savvyMultiplierService');

/**
 * GET /api/savvy/multiplier
 * Authoritative Savvy earnings multiplier + component breakdown.
 */
router.get('/multiplier', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { clearExpiredSavvyBoosts, resolveSavvyMultiplierState } = require('../services/savvyMultiplierService');
    const cleared = clearExpiredSavvyBoosts(user);
    if (cleared) {
      await user.save();
    }
    return res.json(resolveSavvyMultiplierState(user));
  } catch (error) {
    console.error('Savvy multiplier error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
