// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ReferralLog = require('../models/ReferralLog');
const CreatorEvent = require('../models/CreatorEvent');
const auth = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { authLoginLimiter, authMeLimiter, authSignupLimiter } = require('../middleware/rateLimits');
const schemas = require('../validation/schemas');
const { HttpError } = require('../middleware/apiErrors');
const { auditFireAndForget } = require('../services/securityAuditService');

const { referralFraudCheck, logReferral } = require('../services/referralGuard');

const router = express.Router();

const REFERRAL_POINTS = Number(process.env.REFERRAL_POINTS || 5000);
const REFERRAL_DAILY_CAP = Number(process.env.REFERRAL_DAILY_CAP || 10);

const BCRYPT_ROUNDS = 12;

function signUserToken(user) {
  const sub = String(user._id);
  return jwt.sign({ sub, id: user._id, userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

const { isBetaTester: checkBetaTester } = require('../services/betaTesterService');
const {
  ensureFounderAdminRole,
  applyFounderAdminAuthOverride,
} = require('../lib/founderAdminAccess');
const { serializeMembershipForClient } = require('../lib/membershipFields');

function hasFoundingTesterAccess(user) {
  return checkBetaTester(user);
}

function foundingTesterActiveFor(user) {
  return hasFoundingTesterAccess(user);
}

function serializeAuthUserPayload(user) {
  const role = String(user.role || 'user');
  const perms = user.adminPermissions || {};
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;
  const foundingTesterActive = foundingTesterActiveFor(user);
  return applyFounderAdminAuthOverride({
    id: user._id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role,
    isSuperAdmin,
    isAdmin,
    adminPermissions: {
      canManageShield: isSuperAdmin || Boolean(perms.canManageShield),
      canManageUsers: isSuperAdmin || Boolean(perms.canManageUsers),
      canManagePromotions: isSuperAdmin || Boolean(perms.canManagePromotions),
      canManagePayments: isSuperAdmin || Boolean(perms.canManagePayments),
      canViewAnalytics: isSuperAdmin || Boolean(perms.canViewAnalytics),
    },
    betaTester: Boolean(user.betaTester),
    foundingAccess: Boolean(user.foundingAccess),
    foundingTesterActive,
    isBetaTester: foundingTesterActive,
  });
}

function serializeAuthMePayload(user) {
  const membership = serializeMembershipForClient(user);
  const sub = user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
  return {
    ...serializeAuthUserPayload(user),
    ...membership,
    points: user.points,
    referralCode: user.referralCode,
    referredBy: user.referredBy || null,
    premiumTier: user.premiumTier || user.membershipTier || 'free',
    leaderboardScore: user.leaderboardScore ?? 0,
    currentStreak: user.currentStreak ?? 0,
    powerMultiplier: user.powerMultiplier ?? 1,
    equippedCosmetics: user.equippedCosmetics || {
      emblemId: 'sigil_starter',
      callingCardId: 'card_default',
      titleId: null,
    },
    creatorId: user.creatorId || null,
    creatorHandle: user.creatorHandle || null,
    attributedTo: user.attributedTo || null,
    creatorCodeApplied: user.creatorCodeApplied || null,
    followingCount: Array.isArray(user.following) ? user.following.length : 0,
    followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
    pinnedWins: user.pinnedWins || [],
    weeklyStats: user.weeklyStats || null,
    subscription: {
      tier: membership.tier === 'free' ? 'free' : membership.subscriptionTier || sub.tier || 'free',
      billing: sub.billing || 'monthly',
      multiplier: sub.multiplier ?? 1,
      earlyAdopter: Boolean(sub.earlyAdopter),
      renewalDate: user.subscriptionExpires || sub.renewalDate || null,
      badge: sub.badge || '',
    },
    savvyPoints: Number(user.savvyPoints || 0),
    flipBestScoreEver:
      user.flipBestScoreEver != null && Number.isFinite(Number(user.flipBestScoreEver))
        ? Math.round(Number(user.flipBestScoreEver) * 10) / 10
        : null,
    flipTotalCompleted: Number(user.flipTotalCompleted || 0),
    flipAverageScore:
      user.flipTotalCompleted > 0 && Number.isFinite(Number(user.flipScoreLifetimeSum))
        ? Math.round((Number(user.flipScoreLifetimeSum) / Number(user.flipTotalCompleted)) * 10) / 10
        : null,
    badges: Array.isArray(user.badges) ? user.badges : [],
    earlyAdopterLocked: Boolean(user.earlyAdopterLocked),
    earlyAdopterOriginalPrice: user.earlyAdopterOriginalPrice || null,
    betaAccessExpiresAt: user.betaAccessExpiresAt || null,
    foundingTesterAccess: foundingTesterActiveFor(user),
  };
}

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
 * POST /api/auth/register (alias)
 */
async function handleSignup(req, res, next) {
  try {
    const { firstName, lastName, username, email, password, referralCode } = req.body;
    // Phase B: client-supplied attribution payload (creator deep links, etc.).
    // We accept it loosely — schema validation is intentionally lenient so
    // we never block a signup on missing/extra attribution fields.
    const attribution = (req.body && typeof req.body.attribution === 'object') ? req.body.attribution : null;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return next(new HttpError(400, 'SIGNUP_CONFLICT', 'Email or username already in use'));
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let signupBonus = 100;
    let membershipTier = 'free';
    let subscriptionExpires = null;

    if (referralCode === 'welcome') {
      signupBonus = 500;
      membershipTier = 'premium';
      subscriptionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const user = await User.create({
      firstName,
      lastName,
      username,
      email,
      password: passwordHash,
      points: signupBonus,
      lastActive: new Date(),
      referralCodeUsed: referralCode || null,
      membershipTier,
      subscriptionExpires,
    });

    user.referralCode = user._id.toString();

    let referrer = null;
    if (referralCode) {
      referrer =
        (await User.findOne({ referralCode })) ||
        (await User.findById(referralCode).catch(() => null));
      if (referrer && String(referrer._id) === String(user._id)) {
        await logReferral({
          referrerId: referrer._id,
          refereedId: user._id,
          ip: '',
          ua: '',
          status: 'blocked',
          reason: 'self_by_id',
        });
        referrer = null;
      }
    }

    await user.save();

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
        const todayAcceptedCount = await ReferralLog.countDocuments({
          referrerId: referrer._id,
          status: 'accepted',
          createdAt: { $gte: startOfToday(), $lte: endOfToday() },
        });

        if (todayAcceptedCount < REFERRAL_DAILY_CAP) {
          await User.updateOne({ _id: referrer._id }, { $inc: { points: REFERRAL_POINTS } });

          await logReferral({
            referrerId: referrer._id,
            refereedId: user._id,
            ip: check.ip || '',
            ua: check.ua || '',
            status: 'accepted',
            reason: 'ok',
          });
        } else {
          await logReferral({
            referrerId: referrer._id,
            refereedId: user._id,
            ip: check.ip || '',
            ua: check.ua || '',
            status: 'capped',
            reason: 'daily_cap_reached',
          });
        }

        user.referredBy = referrer._id;

        if (referralCode !== 'welcome') {
          user.points += 200;
        }

        await user.save();
      }
    }

    // Phase B: persist attribution and log a creator signup event.
    if (attribution) {
      try {
        await user.applyAttribution(attribution);
        if (user.creatorId || user.creatorHandle) {
          await CreatorEvent.create({
            type: 'signup',
            creatorId: user.creatorId || null,
            creatorHandle: user.creatorHandle || attribution.creatorHandle || null,
            creatorCode: user.creatorCodeApplied || attribution.creatorCode || null,
            campaign: user.attributionCampaign || attribution.campaign || null,
            source: user.referralSource || attribution.source || null,
            landingPath: user.attributionLandingPath || attribution.landingPath || null,
            userId: user._id,
            amount: 0,
          });
        }
      } catch (attrErr) {
        // Attribution should never break signup.
        // eslint-disable-next-line no-console
        console.error('Attribution apply failed:', attrErr);
      }
    }

    const token = signUserToken(user);

    auditFireAndForget('AUTH_SIGNUP', { userId: user._id, req, meta: { username: user.username } });

    return res.status(201).json({
      token,
      user: {
        ...serializeAuthUserPayload(user),
        points: user.points,
        referralCode: user.referralCode,
        referralCodeUsed: user.referralCodeUsed,
        referredBy: user.referredBy || null,
        membershipTier: user.membershipTier,
        subscriptionExpires: user.subscriptionExpires,
        creatorId: user.creatorId || null,
        creatorHandle: user.creatorHandle || null,
        attributedTo: user.attributedTo || null,
        creatorCodeApplied: user.creatorCodeApplied || null,
        betaTester: Boolean(user.betaTester),
        foundingAccess: Boolean(user.foundingAccess),
        betaAccessExpiresAt: user.betaAccessExpiresAt || null,
        foundingTesterAccess: hasFoundingTesterAccess(user),
        isBetaTester: hasFoundingTesterAccess(user),
      },
    });
  } catch (err) {
    return next(err);
  }
}

const signupMiddleware = [authSignupLimiter, validateRequest(schemas.authSignupBody), handleSignup];
router.post('/signup', signupMiddleware);
router.post('/register', signupMiddleware);

/**
 * POST /api/auth/login
 */
router.post('/login', authLoginLimiter, validateRequest(schemas.authLoginBody), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const ok = user ? await bcrypt.compare(password, user.password) : false;
    if (!user || !ok) {
      auditFireAndForget('AUTH_LOGIN_FAILED', { req, severity: 'warn', meta: {} });
      return next(new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid credentials'));
    }

    await ensureFounderAdminRole(user);

    const token = signUserToken(user);
    return res.json({
      token,
      user: {
        ...serializeAuthUserPayload(user),
        points: user.points,
        referralCode: user.referralCode,
        referredBy: user.referredBy || null,
        betaTester: Boolean(user.betaTester),
        foundingAccess: Boolean(user.foundingAccess),
        betaAccessExpiresAt: user.betaAccessExpiresAt || null,
        foundingTesterAccess: hasFoundingTesterAccess(user),
        isBetaTester: hasFoundingTesterAccess(user),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authMeLimiter, auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));

    await ensureFounderAdminRole(user);

    return res.json(serializeAuthMePayload(user));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
