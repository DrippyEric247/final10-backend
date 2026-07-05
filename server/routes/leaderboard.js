// server/routes/leaderboard.js
const express = require('express');
const User = require('../models/User');
const SavvyFlipRewardLog = require('../models/SavvyFlipRewardLog');
const BattlePassProgress = require('../models/BattlePassProgress');
const { computeTierFromXp } = require('../lib/battlePassConfig');

const router = express.Router();

function deriveRankBadge(score, rank) {
  if (rank === 1) return 'Champion';
  const s = Number(score || 0);
  if (s >= 15000) return 'Elite';
  if (s >= 10000) return 'Gold';
  if (s >= 5000) return 'Silver';
  return 'Bronze';
}

/**
 * GET /api/leaderboard/players
 * Real users only — sorted by leaderboardScore desc, savvyPoints tiebreaker.
 * Returns up to `limit` rows (max 100); no placeholder accounts.
 */
router.get('/players', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));

    const users = await User.find(
      { username: { $exists: true, $nin: [null, ''] } },
      {
        username: 1,
        firstName: 1,
        lastName: 1,
        leaderboardScore: 1,
        savvyPoints: 1,
        loginStreakDays: 1,
        currentStreak: 1,
        equippedCosmetics: 1,
        powerMultiplier: 1,
        premiumTier: 1,
      }
    ).lean();

    const userIds = users.map((u) => u._id);
    const bpRows = await BattlePassProgress.find({ userId: { $in: userIds } })
      .select('userId xp tier')
      .lean();
    const bpByUser = new Map(bpRows.map((r) => [String(r.userId), r]));

    const rows = users.map((u) => {
      const leaderboardScore = Math.max(0, Number(u.leaderboardScore) || 0);
      const savvyPoints = Math.max(0, Number(u.savvyPoints) || 0);
      const score = leaderboardScore > 0 ? leaderboardScore : savvyPoints;
      const bp = bpByUser.get(String(u._id));
      const bpXp = Number(bp?.xp) || 0;
      const prestige = computeTierFromXp(bpXp);
      const streakDays = Math.max(0, Number(u.loginStreakDays ?? u.currentStreak) || 0);

      return {
        userId: String(u._id),
        username: u.username,
        displayName: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username,
        score,
        leaderboardScore,
        savvyPoints,
        emblemId: u.equippedCosmetics?.emblemId || 'sigil_starter',
        callingCardId: u.equippedCosmetics?.callingCardId || 'card_default',
        streakDays,
        prestige,
        bpTierCleared: prestige,
        bpXp,
        powerMultiplier: u.powerMultiplier ?? 1,
        premiumTier: u.premiumTier || 'free',
      };
    });

    rows.sort((a, b) => {
      if (b.leaderboardScore !== a.leaderboardScore) {
        return b.leaderboardScore - a.leaderboardScore;
      }
      if (b.savvyPoints !== a.savvyPoints) {
        return b.savvyPoints - a.savvyPoints;
      }
      return String(a.username).localeCompare(String(b.username));
    });

    const ranked = rows.slice(0, limit).map((row, index) => ({
      ...row,
      rank: index + 1,
      rankBadge: deriveRankBadge(row.score, index + 1),
    }));

    res.json({
      players: ranked,
      count: ranked.length,
      totalUsers: users.length,
    });
  } catch (err) {
    console.error('leaderboard players', err);
    res.status(500).json({ message: 'Server error' });
  }
});

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
