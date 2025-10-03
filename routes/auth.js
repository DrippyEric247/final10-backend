// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ReferralLog = require('../models/ReferralLog');
const auth = require('../middleware/auth');


// import ONCE from the service (remove any duplicate local definitions)
const { referralFraudCheck, logReferral } = require('../services/referralGuard');

const router = express.Router();

const REFERRAL_POINTS = Number(process.env.REFERRAL_POINTS || 5000);
const REFERRAL_DAILY_CAP = Number(process.env.REFERRAL_DAILY_CAP || 10);

// helpers
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * POST /api/auth/signup
 * Body: { firstName, lastName, username, email, password, referralCode? }
 */
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password, referralCode } = req.body || {};

    // basic checks
    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ message: 'Email or username already in use' });

    // create user with signup bonus
    const passwordHash = await bcrypt.hash(password, 10);
    let signupBonus = 100; // Give new users 100 points for signing up
    let membershipTier = 'free';
    let subscriptionExpires = null;
    
    // Special bonus for "welcome" referral code
    if (referralCode === 'welcome') {
      signupBonus = 500; // Extra bonus for welcome code
      membershipTier = 'premium'; // Give 7-day free trial
      subscriptionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
    
    const user = await User.create({
      firstName, 
      lastName, 
      username, 
      email, 
      password: passwordHash, 
      points: signupBonus, 
      lastActive: new Date(),
      referralCodeUsed: referralCode || null, // Track which referral code was used
      membershipTier,
      subscriptionExpires
    });

    // give each user their own shareable code (their _id as string is simple & unique)
    user.referralCode = user._id.toString();

    let referrer = null;
    if (referralCode) {
      // accept either a stored code (referrer.referralCode) OR a raw ObjectId
      referrer =
        (await User.findOne({ referralCode })) ||
        (await User.findById(referralCode).catch(() => null));
      if (referrer && String(referrer._id) === String(user._id)) {
        // self-ref by id
        await logReferral({ referrerId: referrer._id, refereedId: user._id, ip: '', ua: '', status: 'blocked', reason: 'self_by_id' });
        referrer = null;
      }
    }

    // save the user (with referralCode set)
    await user.save();

    // Handle referral credit if there is a valid referrer
    if (referrer) {
      const check = await referralFraudCheck(req, referrer._id, email, user._id);

      if (!check.ok) {
        await logReferral({
          referrerId: referrer._id,
          refereedId: user._id,
          ip: check.ip || '',
          ua: check.ua || '',
          status: 'blocked',
          reason: check.reason || 'failed_check',
        });
      } else {
        // within daily cap?
        const todayAcceptedCount = await ReferralLog.countDocuments({
          referrerId: referrer._id,
          status: 'accepted',
          createdAt: { $gte: startOfToday(), $lte: endOfToday() },
        });

        if (todayAcceptedCount < REFERRAL_DAILY_CAP) {
          // award points
          await User.updateOne(
            { _id: referrer._id },
            { $inc: { points: REFERRAL_POINTS } }
          );

          await logReferral({
            referrerId: referrer._id,
            refereedId: user._id,
            ip: check.ip || '',
            ua: check.ua || '',
            status: 'accepted',
            reason: 'ok',
          });
        } else {
          // cap reached — log but do not award more
          await logReferral({
            referrerId: referrer._id,
            refereedId: user._id,
            ip: check.ip || '',
            ua: check.ua || '',
            status: 'capped',
            reason: 'daily_cap_reached',
          });
        }

        // keep a simple backlink for analytics (optional)
        user.referredBy = referrer._id;
        
        // Give the new user bonus points for using a referral code (if not already got welcome bonus)
        if (referralCode !== 'welcome') {
          user.points += 200; // Bonus for using any referral code
        }
        
        await user.save();
      }
    }

    // sign JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        points: user.points,
        referralCode: user.referralCode,
        referralCodeUsed: user.referralCodeUsed,
        referredBy: user.referredBy || null,
        membershipTier: user.membershipTier,
        subscriptionExpires: user.subscriptionExpires,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ message: 'Server error during registration' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        points: user.points,
        referralCode: user.referralCode,
        referredBy: user.referredBy || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      points: user.points,
      referralCode: user.referralCode,
      referredBy: user.referredBy || null,
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
