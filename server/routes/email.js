const crypto = require('crypto');
const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const { sendTestEmail, getEmailConfigStatus } = require('../services/emailService');
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
      return res.json({
        ok: true,
        ...result,
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
        return res.json({
          ok: true,
          ...result,
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
