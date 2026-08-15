const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  clearExpiredSavvyBoosts,
  resolveSavvyMultiplierState,
  calculateSavvyReward,
} = require('../services/savvyMultiplierService');

/**
 * GET /api/savvy/multiplier
 * Authoritative Savvy earnings multiplier + component breakdown.
 */
router.get('/multiplier', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
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

/**
 * POST /api/savvy/calculate-reward
 * Server-authoritative reward preview (same math as payout).
 * body: { baseAmount: number, source?: string }
 */
router.post('/calculate-reward', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const baseAmount = Math.round(Number(req.body?.baseAmount) || 0);
    if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      return res.status(400).json({ message: 'Invalid baseAmount' });
    }

    const cleared = clearExpiredSavvyBoosts(user);
    if (cleared) {
      await user.save();
    }

    const result = calculateSavvyReward(user, baseAmount, {
      source: req.body?.source || req.body?.rewardType || 'unknown',
    });
    return res.json(result);
  } catch (error) {
    console.error('Savvy calculate-reward error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
