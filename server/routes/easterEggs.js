const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { easterEggRedeemLimiter } = require('../middleware/rateLimits');
const {
  redeemEasterEggCode,
  listEasterEggHintsForUser,
  getUserRedemptionHistory,
  getEasterEggStats,
  EASTER_EGG_CODES,
} = require('../services/easterEggService');
const EasterEggRedemption = require('../models/EasterEggRedemption');

router.use(auth);

router.post('/redeem', easterEggRedeemLimiter, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ message: 'Code is required' });
    }

    const result = await redeemEasterEggCode(userId, code);
    if (!result.ok) {
      return res.status(result.status || 400).json({
        message: result.message,
        alreadyRedeemed: result.alreadyRedeemed,
      });
    }

    return res.json({
      success: true,
      message: result.message,
      easterEgg: result.easterEgg,
      pointsEarned: result.pointsEarned,
      savvyEarned: result.savvyEarned,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error('Error redeeming easter egg code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** Hints only — does not leak full codes or point values. */
router.get('/available', async (req, res) => {
  try {
    const userId = req.user.id;
    const redeemed = await EasterEggRedemption.find({ userId }).select('code').lean();
    const redeemedCodes = redeemed.map((r) => r.code);
    const availableCodes = listEasterEggHintsForUser(redeemedCodes);

    res.json({
      available: availableCodes,
      totalAvailable: availableCodes.length,
      totalCodes: Object.keys(EASTER_EGG_CODES).length,
    });
  } catch (error) {
    console.error('Error getting available easter egg codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const redemptions = await getUserRedemptionHistory(req.user.id);
    res.json({
      redemptions,
      totalRedeemed: redemptions.length,
      totalPointsEarned: redemptions.reduce((sum, r) => sum + r.points, 0),
    });
  } catch (error) {
    console.error('Error getting redemption history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const stats = await getEasterEggStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting easter egg statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/admin/add', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    return res.status(501).json({
      message: 'Dynamic easter egg codes are disabled. Add codes to easterEggService config.',
    });
  } catch (error) {
    console.error('Error adding easter egg code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/admin/:code', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    return res.status(501).json({
      message: 'Dynamic easter egg removal is disabled. Update easterEggService config.',
    });
  } catch (error) {
    console.error('Error removing easter egg code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
