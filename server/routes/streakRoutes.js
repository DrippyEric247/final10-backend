const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { claimDailyStreak, getStreakStatus } = require('../services/dailyStreakService');

const router = express.Router();

router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(getStreakStatus(user));
  } catch (err) {
    console.error('[streak/status]', err);
    res.status(500).json({ message: 'Failed to load streak status' });
  }
});

router.post('/claim', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const result = await claimDailyStreak(user);
    const savvyEarned = Number(result.totalSavvy) || 0;
    const msg =
      savvyEarned > 0
        ? `Daily streak claimed! +${savvyEarned} Savvy`
        : result.alreadyClaimed
          ? 'Daily streak already claimed today'
          : `Day ${result.currentStreak} streak logged`;

    res.json({
      message: msg,
      ...result,
      savvyPointsEarned: savvyEarned,
      pointsEarned: savvyEarned,
      totalPoints: result.newBalance,
      dailyTasks: typeof user.getDailyTasks === 'function' ? user.getDailyTasks() : undefined,
    });
  } catch (err) {
    console.error('[streak/claim]', err);
    res.status(500).json({ message: 'Failed to claim daily streak' });
  }
});

module.exports = router;
