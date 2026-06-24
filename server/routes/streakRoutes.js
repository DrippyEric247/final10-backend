const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const { claimDailyStreak, getStreakStatus } = require('../services/dailyStreakService');
const {
  adminForceClaimToday,
  adminAdvanceStreak,
  adminSetMilestone,
  ADMIN_MILESTONE_DAYS,
} = require('../services/dailyStreakAdminService');

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

/** Admin-only streak testing */
router.post('/admin/force-claim', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.user.id);
    if (!targetUser) {
      return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    }
    const result = await adminForceClaimToday(targetUser, req.adminUser);
    res.json({
      message: result.alreadyClaimed
        ? 'Already claimed today (after force unlock attempt)'
        : `Force claim complete · +${result.totalSavvy || 0} Savvy`,
      ...result,
    });
  } catch (err) {
    console.error('[streak/admin/force-claim]', err);
    next(err);
  }
});

router.post('/admin/advance', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.user.id);
    if (!targetUser) {
      return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    }
    const result = await adminAdvanceStreak(targetUser, req.adminUser);
    res.json({
      message: `Streak advanced to day ${result.advancedTo}`,
      ...result,
    });
  } catch (err) {
    console.error('[streak/admin/advance]', err);
    next(err);
  }
});

router.post('/admin/set-milestone', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const milestoneDay = Number(req.body?.day ?? req.body?.milestoneDay);
    if (!Number.isFinite(milestoneDay)) {
      return next(new HttpError(400, 'INVALID_DAY', 'day is required'));
    }
    const targetUser = await User.findById(req.user.id);
    if (!targetUser) {
      return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    }
    const result = await adminSetMilestone(targetUser, req.adminUser, milestoneDay);
    res.json({
      message: `Streak set to day ${result.milestoneDay} · rewards granted`,
      ...result,
    });
  } catch (err) {
    if (err.status === 400) {
      return next(new HttpError(400, 'INVALID_MILESTONE', err.message));
    }
    console.error('[streak/admin/set-milestone]', err);
    next(err);
  }
});

router.get('/admin/milestones', auth, requireAdminAccess(), (req, res) => {
  res.json({ allowed: true, milestones: ADMIN_MILESTONE_DAYS });
});

module.exports = router;
