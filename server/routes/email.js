const crypto = require('crypto');
const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { sendTestEmail, getEmailConfigStatus, buildSavvyScoutDealFoundEmail } = require('../services/emailService');
const { HttpError } = require('../middleware/apiErrors');

function readGrantSecretHeader(req) {
  return String(
    req.headers['x-owner-grant-secret'] ||
      req.get('X-Owner-Grant-Secret') ||
      ''
  ).trim();
}

function grantSecretValid(req) {
  const expected = String(process.env.OWNER_GRANT_SECRET || '').trim();
  const provided = readGrantSecretHeader(req);
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * GET /api/email/status
 * SMTP readiness (no secrets). Auth JWT or X-Owner-Grant-Secret.
 */
router.get('/status', (req, res, next) => {
  if (grantSecretValid(req)) {
    return res.json(getEmailConfigStatus());
  }
  return auth(req, res, () => res.json(getEmailConfigStatus()));
});

function smtpFailureStatus(result) {
  if (result.errorCode === 'ETIMEDOUT' || result.errorCode === 'ESOCKET') return 504;
  if (result.provider === 'resend' && Number(result.responseCode) >= 400) {
    return Number(result.responseCode) >= 500 ? 502 : 400;
  }
  return 502;
}

function jsonEmailTestResult(res, result, meta) {
  if (!result.sent) {
    return res.status(smtpFailureStatus(result)).json({
      ok: false,
      ...result,
      ...meta,
    });
  }
  return res.json({
    ok: true,
    ...result,
    ...meta,
  });
}

/**
 * GET /api/email/preview/deal-found
 * Returns HTML for the Savvy Scout deal notification (JWT or owner secret).
 */
router.get('/preview/deal-found', (req, res, next) => {
  const render = () => {
    const sample = {
      userName: 'Eric',
      productTitle: 'PlayStation 5 Slim Console — Disc Edition',
      productImage: 'https://i.ebayimg.com/images/g/example/ps5.jpg',
      currentPrice: 374.99,
      originalPrice: 499.99,
      savingsAmount: 125,
      savingsPercent: 25,
      trustScore: 94,
      rankedAbovePercent: 97,
      shippingStatus: 'Fast Shipping Available',
      baseReward: 250,
      premiumBonus: 125,
      seasonPassBonus: 80,
      doublePointBonus: 150,
      doublePointActive: true,
      userLevel: 'Founding Tester',
      savvyBalance: 4250,
      currentMultiplier: '1.5X',
      nextRewardTier: 'Deal Hunter',
      progressPercent: 75,
    };
    const { html } = buildSavvyScoutDealFoundEmail(sample);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  };

  if (grantSecretValid(req)) return render();
  return auth(req, res, () => render());
});

/**
 * POST /api/email/test
 * Send a test email. Body: { "to": "you@example.com" } (optional with JWT — defaults to your account email).
 * Auth: Bearer JWT (own email only) OR X-Owner-Grant-Secret (any recipient).
 */
router.post('/test', async (req, res, next) => {
  try {
    const bodyTo = String(req.body?.to || '').trim().toLowerCase();

    if (grantSecretValid(req)) {
      if (!bodyTo) {
        return next(new HttpError(400, 'BAD_REQUEST', 'Body field "to" is required'));
      }
      const result = await sendTestEmail({ to: bodyTo });
      return jsonEmailTestResult(res, result, {
        recipient: bodyTo,
        via: 'owner-grant-secret',
      });
    }

    return auth(req, res, async (authErr) => {
      if (authErr) return next(authErr);
      try {
        const user = await User.findById(req.user._id || req.user.id).select('email');
        if (!user) return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));

        const recipient = (bodyTo || user.email || '').trim().toLowerCase();
        if (!recipient) {
          return next(new HttpError(400, 'BAD_REQUEST', 'No email on account; pass "to" in body'));
        }
        if (bodyTo && bodyTo !== String(user.email || '').trim().toLowerCase()) {
          return next(new HttpError(403, 'FORBIDDEN', 'JWT test emails may only be sent to your own account email'));
        }

        const result = await sendTestEmail({ to: recipient });
        return jsonEmailTestResult(res, result, {
          recipient,
          via: 'jwt',
        });
      } catch (err) {
        return next(err);
      }
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
