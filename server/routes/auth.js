// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CreatorEvent = require('../models/CreatorEvent');
const auth = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { authLoginLimiter, authMeLimiter, authSignupLimiter, authPasswordResetLimiter, authPasswordResetSubmitLimiter } = require('../middleware/rateLimits');
const schemas = require('../validation/schemas');
const { HttpError } = require('../middleware/apiErrors');
const { auditFireAndForget } = require('../services/securityAuditService');
const { requestPasswordReset, resetPasswordWithToken } = require('../services/passwordResetService');

const { getClientIp, getClientUa } = require('../services/referralGuard');
const { processReferralOnSignup, resolveReferrer } = require('../services/referralService');

const { googleEnabled, appleEnabled } = require('../config/socialAuthConfig');
const socialAuth = require('../services/socialAuthService');

const router = express.Router();

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
    currentStreak: user.loginStreakDays ?? user.currentStreak ?? 0,
    loginStreakDays: user.loginStreakDays ?? 0,
    longestStreak: user.longestStreak ?? user.loginStreakDays ?? 0,
    lastLoginDate: user.lastLoginDay ?? null,
    scoutShields: user.dailyStreak?.scoutShields ?? 0,
    scoutEggs: user.dailyStreak?.scoutEggs ?? {
      common: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
    },
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
      referrer = await resolveReferrer(referralCode);
      if (referrer && String(referrer._id) === String(user._id)) {
        referrer = null;
      }
    }

    await user.save();

    if (referrer) {
      await processReferralOnSignup({
        referrer,
        referee: user,
        referralCode,
        ip: getClientIp(req),
        ua: getClientUa(req),
        req,
      });
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

/* ============================ Social OAuth ============================== */

/**
 * GET /api/auth/providers
 * Lets the client show only the social buttons that are configured.
 */
router.get('/providers', (req, res) => {
  res.json({ google: googleEnabled(), apple: appleEnabled() });
});

/** Finalize any verified social profile → JWT + redirect back to the client. */
async function completeSocialLogin(profile, provider, res) {
  const { user, isNew } = await socialAuth.findOrCreateSocialUser(profile);
  await ensureFounderAdminRole(user);
  const token = signUserToken(user);
  auditFireAndForget(isNew ? 'AUTH_SIGNUP' : 'AUTH_LOGIN_SOCIAL', {
    userId: user._id,
    meta: { provider, isNew },
  });
  return res.redirect(socialAuth.buildClientSuccessRedirect(token, provider));
}

/** GET /api/auth/google → redirect to Google consent screen. */
router.get('/google', (req, res) => {
  if (!googleEnabled()) {
    return res.redirect(socialAuth.buildClientErrorRedirect('google_not_configured', 'google'));
  }
  try {
    return res.redirect(socialAuth.getGoogleAuthUrl());
  } catch (err) {
    console.error('[auth/google] start failed', err);
    return res.redirect(socialAuth.buildClientErrorRedirect('google_start_failed', 'google'));
  }
});

/** GET /api/auth/google/callback → exchange code, verify, sign JWT, redirect. */
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query || {};
  if (error) {
    return res.redirect(socialAuth.buildClientErrorRedirect('cancelled', 'google'));
  }
  if (!code || !state) {
    return res.redirect(socialAuth.buildClientErrorRedirect('missing_code', 'google'));
  }
  try {
    const verifiedState = socialAuth.verifyState(String(state), 'google');
    const profile = await socialAuth.exchangeGoogleCode(String(code), verifiedState.nonce);
    return await completeSocialLogin(profile, 'google', res);
  } catch (err) {
    console.error('[auth/google/callback] failed', err.message);
    return res.redirect(socialAuth.buildClientErrorRedirect('google_auth_failed', 'google'));
  }
});

/** GET /api/auth/apple → redirect to Apple sign-in. */
router.get('/apple', (req, res) => {
  if (!appleEnabled()) {
    return res.redirect(socialAuth.buildClientErrorRedirect('apple_not_configured', 'apple'));
  }
  try {
    return res.redirect(socialAuth.getAppleAuthUrl());
  } catch (err) {
    console.error('[auth/apple] start failed', err);
    return res.redirect(socialAuth.buildClientErrorRedirect('apple_start_failed', 'apple'));
  }
});

/**
 * POST /api/auth/apple/callback
 * Apple posts back as application/x-www-form-urlencoded (response_mode=form_post)
 * because we request name/email scope. We parse the body locally so the global
 * JSON parser doesn't need to change.
 */
router.post('/apple/callback', express.urlencoded({ extended: false }), async (req, res) => {
  const { code, state, error, user: appleUser } = req.body || {};
  if (error) {
    return res.redirect(socialAuth.buildClientErrorRedirect('cancelled', 'apple'));
  }
  if (!code || !state) {
    return res.redirect(socialAuth.buildClientErrorRedirect('missing_code', 'apple'));
  }
  try {
    const verifiedState = socialAuth.verifyState(String(state), 'apple');
    const profile = await socialAuth.exchangeAppleCode(String(code), verifiedState.nonce, appleUser);
    return await completeSocialLogin(profile, 'apple', res);
  } catch (err) {
    console.error('[auth/apple/callback] failed', err.message);
    return res.redirect(socialAuth.buildClientErrorRedirect('apple_auth_failed', 'apple'));
  }
});

/* Some Apple configurations return to the callback via GET (no name/email scope). */
router.get('/apple/callback', async (req, res) => {
  const { code, state, error } = req.query || {};
  if (error) {
    return res.redirect(socialAuth.buildClientErrorRedirect('cancelled', 'apple'));
  }
  if (!code || !state) {
    return res.redirect(socialAuth.buildClientErrorRedirect('missing_code', 'apple'));
  }
  try {
    const verifiedState = socialAuth.verifyState(String(state), 'apple');
    const profile = await socialAuth.exchangeAppleCode(String(code), verifiedState.nonce, null);
    return await completeSocialLogin(profile, 'apple', res);
  } catch (err) {
    console.error('[auth/apple/callback GET] failed', err.message);
    return res.redirect(socialAuth.buildClientErrorRedirect('apple_auth_failed', 'apple'));
  }
});

/**
 * POST /api/auth/forgot-password
 * Always returns the same message — never reveals whether the email exists.
 */
router.post(
  '/forgot-password',
  authPasswordResetLimiter,
  validateRequest(schemas.authForgotPasswordBody),
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const result = await requestPasswordReset(email);
      auditFireAndForget('AUTH_PASSWORD_RESET_REQUEST', {
        req,
        severity: 'info',
        meta: { requested: true },
      });
      return res.json({ message: result.message });
    } catch (err) {
      console.error('[auth/forgot-password]', err.message);
      return next(err);
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Validates token server-side, hashes new password, invalidates token (single-use).
 */
router.post(
  '/reset-password',
  authPasswordResetSubmitLimiter,
  validateRequest(schemas.authResetPasswordBody),
  async (req, res, next) => {
    try {
      const { token, password } = req.body;
      const result = await resetPasswordWithToken(token, password);
      auditFireAndForget('AUTH_PASSWORD_RESET_COMPLETE', {
        userId: result.userId,
        req,
        severity: 'info',
        meta: { success: true },
      });
      return res.json({ message: result.message });
    } catch (err) {
      if (err.status) {
        auditFireAndForget('AUTH_PASSWORD_RESET_FAILED', {
          req,
          severity: 'warn',
          meta: { code: err.code || 'INVALID_RESET_TOKEN' },
        });
        return res.status(err.status).json({
          message: err.message,
          code: err.code,
        });
      }
      console.error('[auth/reset-password]', err.message);
      return next(err);
    }
  }
);

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
