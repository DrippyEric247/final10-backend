// server/routes/points.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const User = require('../models/User');
const Points = require('../models/PointsLedger');
const CFG = require('../config/points');

// ---- GET /api/points ----
// returns just the points balance (for compatibility)
router.get('/', auth, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  res.json({ points: user.pointsBalance || 0 });
});

// ---- GET /api/points/me ----
// returns balance, lifetime, badges, recent ledger, and trial
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const recent = await Points.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  res.json({
    pointsBalance: user.pointsBalance ?? 0,
    lifetimePointsEarned: user.lifetimePointsEarned ?? 0,
    badges: user.badges ?? [],
    recent,
    trial: user.trial ?? { isActive: false },
  });
});

// ---- POST /api/points/redeem ----
// body: { amount:number, auctionId?:string, idempotencyKey:string }
router.post('/redeem', auth, async (req, res) => {
  try {
    const { amount, auctionId, idempotencyKey } = req.body || {};
    const pts = parseInt(amount, 10);

    if (!idempotencyKey) return res.status(400).json({ error: 'Missing idempotencyKey' });
    if (!Number.isInteger(pts) || pts <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.pointsBalance ?? 0) < pts) return res.status(400).json({ error: 'Insufficient points' });

    // create ledger row (idempotent)
    try {
      await Points.create({
        userId: user._id,
        type: 'redeem',
        amount: pts,
        source: 'auction_redeem',
        refId: auctionId || 'n/a',
        idempotencyKey,
      });
    } catch (e) {
      if (e?.code === 11000) {
        // duplicate idempotencyKey -> treat as success
        const discountUSD = pts * CFG.DISCOUNT_RATIO;
        return res.json({ ok: true, idempotent: true, discountUSD, newBalance: user.pointsBalance - pts });
      }
      throw e;
    }

    // update spendable balance (lifetime DOES NOT change)
    user.pointsBalance = (user.pointsBalance ?? 0) - pts;
    await user.save();

    const discountUSD = pts * CFG.DISCOUNT_RATIO;
    return res.json({ ok: true, discountUSD, newBalance: user.pointsBalance });
  } catch (err) {
    console.error('Redeem error', err);
    return res.status(500).json({ error: 'Redeem failed' });
  }
});

// ---- POST /api/points/daily-claim ----
// claims daily reward points
router.post('/daily-claim', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if user already claimed today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    if (user.lastDailyClaim === today) {
      return res.status(400).json({ error: 'Daily reward already claimed today' });
    }

    // Award daily points (100 points)
    const dailyPoints = 100;
    user.pointsBalance = (user.pointsBalance || 0) + dailyPoints;
    user.lifetimePointsEarned = (user.lifetimePointsEarned || 0) + dailyPoints;
    user.lastDailyClaim = today;
    await user.save();

    // Add to ledger
    await Points.create({
      userId: user._id,
      type: 'earn',
      amount: dailyPoints,
      source: 'daily_claim',
      refId: today,
      idempotencyKey: `daily_claim_${user._id}_${today}`
    });

    res.json({ 
      success: true, 
      pointsAwarded: dailyPoints, 
      newBalance: user.pointsBalance 
    });
  } catch (err) {
    console.error('Daily claim error:', err);
    res.status(500).json({ error: 'Daily claim failed' });
  }
});

module.exports = router;


