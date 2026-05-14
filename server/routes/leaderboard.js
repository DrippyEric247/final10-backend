// server/routes/leaderboard.js
const express = require('express');
const User = require('../models/User');
const SavvyFlipRewardLog = require('../models/SavvyFlipRewardLog');

const router = express.Router();

// GET /api/leaderboard/lifetime
router.get('/lifetime', async (_req, res) => {
  const top = await User.find({}, { username: 1, lifetimePointsEarned: 1, badges: 1 })
    .sort({ lifetimePointsEarned: -1 })
    .limit(100)
    .lean();

  res.json(top);
});

function utcWeekStartMonday(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay(); // 0 Sun .. 6 Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + mondayOffset);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * GET /api/leaderboard/top-flippers-week
 * Rank by Savvy earned from verified flip sale stacks this UTC week.
 */
router.get('/top-flippers-week', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit || '20'), 10) || 20));
    const weekStart = utcWeekStartMonday();

    const rows = await SavvyFlipRewardLog.aggregate([
      {
        $match: {
          kind: 'sale_stack',
          points: { $gt: 0 },
          createdAt: { $gte: weekStart },
        },
      },
      {
        $group: {
          _id: '$userId',
          flipSavvy: { $sum: '$points' },
          flipsCompleted: { $sum: 1 },
        },
      },
      { $sort: { flipSavvy: -1, flipsCompleted: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: User.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'u',
        },
      },
      { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$_id',
          username: { $ifNull: ['$u.username', 'Unknown'] },
          flipSavvy: 1,
          flipsCompleted: 1,
        },
      },
    ]);

    const out = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      username: r.username,
      flipSavvy: r.flipSavvy,
      flipsCompleted: r.flipsCompleted,
    }));

    res.json({
      weekStartsAt: weekStart.toISOString(),
      label: 'Top flippers this week',
      rows: out,
    });
  } catch (err) {
    console.error('leaderboard top-flippers-week', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
