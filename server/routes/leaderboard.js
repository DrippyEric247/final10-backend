// server/routes/leaderboard.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /api/leaderboard/lifetime
router.get('/lifetime', async (_req, res) => {
  const top = await User.find({}, { username: 1, lifetimePointsEarned: 1, badges: 1 })
    .sort({ lifetimePointsEarned: -1 })
    .limit(100)
    .lean();

  res.json(top);
});

module.exports = router;

