// server/routes/points.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const User = require('../models/User');
const Points = require('../models/PointsLedger');
const SavvyTransaction = require('../models/SavvyTransaction');
const CFG = require('../config/points');
const { debitSavvy } = require('../services/savvyBalanceService');
const {
  serializeCreditState,
  convertSavvyToCredits,
  redeemSavvyStoreItem,
} = require('../services/savvyCreditService');
const { SAVVY_STORE_ITEMS } = require('../config/savvyStoreItems');

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

  const recentLedger = await Points.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  const recentTransactions = await SavvyTransaction.find({
    userId: user._id,
    status: 'completed',
  })
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();

  const recent = recentTransactions.map((row) => ({
    _id: row._id,
    userId: row.userId,
    type: row.amount >= 0 ? 'earn' : 'spend',
    amount: Math.abs(row.amount),
    signedAmount: row.amount,
    source: row.source,
    refId: row.meta?.listingId || row.meta?.offerId || row.rewardType || null,
    idempotencyKey: row.idempotencyKey,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    meta: row.meta,
    createdAt: row.createdAt,
    ledger: 'SavvyTransaction',
  }));

  res.json({
    pointsBalance: user.pointsBalance ?? 0,
    savvyPoints: user.savvyPoints ?? user.pointsBalance ?? 0,
    lifetimePointsEarned: user.lifetimePointsEarned ?? 0,
    badges: user.badges ?? [],
    recent,
    recentLedger,
    recentTransactions,
    trial: user.trial ?? { isActive: false },
    savvyCredits: serializeCreditState(user),
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

    const spend = await debitSavvy(user, {
      amount: pts,
      source: 'auction_redeem',
      idempotencyKey: `redeem:${idempotencyKey}`,
      meta: { auctionId: auctionId || 'n/a' },
    });

    if (!spend.granted && !spend.duplicate) {
      return res.status(400).json({ error: 'Insufficient points' });
    }

    await user.save();

    const discountUSD = pts * CFG.DISCOUNT_RATIO;
    return res.json({ ok: true, discountUSD, newBalance: spend.newBalance });
  } catch (err) {
    console.error('Redeem error', err);
    return res.status(500).json({ error: 'Redeem failed' });
  }
});

/** GET /api/points/credits — discount credit wallet */
router.get('/credits', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true, ...serializeCreditState(user), storeItems: SAVVY_STORE_ITEMS });
  } catch (err) {
    console.error('[points/credits]', err);
    res.status(500).json({ error: 'Failed to load credits' });
  }
});

/** POST /api/points/convert-credits — Savvy → discount credit */
router.post('/convert-credits', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const result = await convertSavvyToCredits(user, {
      points: req.body?.points,
      idempotencyKey: req.body?.idempotencyKey,
    });
    await user.save();
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, error: err.message, code: err.code });
    }
    console.error('[points/convert-credits]', err);
    res.status(500).json({ ok: false, error: 'Convert failed' });
  }
});

/** POST /api/points/redeem-store — Savvy store item */
router.post('/redeem-store', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const result = await redeemSavvyStoreItem(user, {
      itemId: req.body?.itemId,
      idempotencyKey: req.body?.idempotencyKey,
    });
    await user.save();
    res.json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, error: err.message, code: err.code });
    }
    console.error('[points/redeem-store]', err);
    res.status(500).json({ ok: false, error: 'Redeem failed' });
  }
});

// ---- POST /api/points/daily-claim ----
// Delegates to the same Savvy daily-login grant as /auctions/claim-daily-login
router.post('/daily-claim', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { claimDailyLoginReward } = require('../services/savvyRewardService');
    const result = await claimDailyLoginReward(user);

    if (result.alreadyClaimed) {
      return res.status(400).json({ error: 'Daily reward already claimed today' });
    }

    const savvyEarned = Number(result.savvyPointsEarned) || 0;

    res.json({
      success: true,
      pointsAwarded: savvyEarned,
      savvyPointsEarned: savvyEarned,
      added: savvyEarned,
      newBalance: result.newBalance ?? user.savvyPoints,
      reward: result.reward,
      message: savvyEarned > 0 ? `+${savvyEarned} Savvy claimed` : 'No reward granted',
    });
  } catch (err) {
    console.error('Daily claim error:', err);
    res.status(500).json({ error: 'Daily claim failed' });
  }
});

module.exports = router;


