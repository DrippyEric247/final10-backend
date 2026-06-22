const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { isAlertTestModeEnabled } = require('../lib/alertTestModeConfig');
const {
  isAlertTestPublicAccess,
  alertTestPublicSecretConfigured,
} = require('../lib/alertTestPublicAccess');
const { runAlertTestPipeline } = require('../services/alertTestModeService');
const { sendTestEmail, getEmailConfigStatus } = require('../services/emailService');
const { isProduction } = require('../config/envValidation');

const router = express.Router();

function testModeAllowed() {
  if (isAlertTestModeEnabled()) return true;
  return !isProduction();
}

function formatTestAlertResponse(user, result) {
  return {
    ok: result.ok,
    listingFound: Boolean(result.selectedListing),
    selectedListing: result.selectedListing || null,
    matchingListings: result.matchingListings || [],
    dealScore: result.dealScore ?? null,
    passesBetaTrigger: result.passesBetaTrigger ?? null,
    whyPicked: result.whyPicked || [],
    emailStatus: result.emailStatus,
    emailStopReason: result.emailStopReason || null,
    emailPipeline: result.emailPipeline || [],
    email: result.email || null,
    emailConfig: result.emailConfig || null,
    emailCooldown: result.emailCooldown || null,
    alertStatus: result.alertStatus,
    alertId: result.alertId || null,
    listingsFound: result.listingsFound ?? 0,
    triggeredCount: result.triggeredCount ?? 0,
    pointsEventActive: result.pointsEventActive ?? false,
    pointsEventMultiplier: result.pointsEventMultiplier ?? 1,
    elapsedMs: result.elapsedMs ?? null,
    message: result.message || null,
    recipient: user?.email ? `${String(user.email).slice(0, 3)}***` : null,
  };
}

/**
 * POST /api/test-alert
 * Beta verification: PS5 search → deal score → Savvy Scout email to authenticated user.
 *
 * Query: ?forceEmail=true — bypass 30-minute email cooldown (beta only)
 * Query: ?skipEmail=true — run pipeline without sending email
 */
router.post('/', auth, async (req, res) => {
  try {
    if (!testModeAllowed()) {
      return res.status(403).json({
        ok: false,
        message:
          'Alert test mode is disabled. Set ALERT_TEST_MODE_ENABLED=true on the server to enable.',
      });
    }

    const user = await User.findById(req.user._id || req.user.id).select(
      'username email savvyPoints pointsBalance membershipTier isPremium subscription loginStreakDays betaTester foundingAccess betaAccessExpiresAt'
    );
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found.' });
    }

    const forceEmail = String(req.query.forceEmail || req.body?.forceEmail || '').toLowerCase() === 'true';
    const skipEmail = String(req.query.skipEmail || req.body?.skipEmail || '').toLowerCase() === 'true';

    const result = await runAlertTestPipeline(user, { forceEmail, skipEmail });

    return res.status(result.ok ? 200 : 404).json(formatTestAlertResponse(user, result));
  } catch (err) {
    console.error('[test-alert] error:', err?.message || err);
    return res.status(500).json({
      ok: false,
      message: 'Alert test pipeline failed.',
      error: String(err?.message || err).slice(0, 200),
    });
  }
});

/**
 * POST /api/test-alert/public
 * No JWT. Verify Resend/Savvy Scout delivery without logging in.
 *
 * Headers (required): X-Alert-Test-Secret or X-Owner-Grant-Secret
 * Body: { "to": "you@example.com" }
 *
 * Query:
 *   ?emailOnly=true  — send Savvy Scout test email only (default)
 *   ?emailOnly=false — full PS5 alert pipeline (user must exist with that email)
 *   ?forceEmail=true — bypass 30-min cooldown (full pipeline)
 *   ?skipEmail=true  — full pipeline without sending
 */
router.post('/public', async (req, res) => {
  try {
    if (!testModeAllowed()) {
      return res.status(403).json({
        ok: false,
        message:
          'Alert test mode is disabled. Set ALERT_TEST_MODE_ENABLED=true on the server to enable.',
      });
    }

    if (!alertTestPublicSecretConfigured()) {
      return res.status(503).json({
        ok: false,
        message:
          'Public test route is not configured. Set ALERT_TEST_PUBLIC_SECRET (16+ chars) or OWNER_GRANT_SECRET on the server.',
      });
    }

    if (!isAlertTestPublicAccess(req)) {
      return res.status(401).json({
        ok: false,
        code: 'UNAUTHORIZED',
        message:
          'Missing or invalid test secret. Send header X-Alert-Test-Secret or X-Owner-Grant-Secret.',
      });
    }

    const to = String(req.body?.to || '').trim().toLowerCase();
    if (!to || !to.includes('@')) {
      return res.status(400).json({
        ok: false,
        message: 'Body field "to" (recipient email) is required.',
      });
    }

    const emailOnlyDefault = String(req.query.emailOnly ?? req.body?.emailOnly ?? 'true').toLowerCase() !== 'false';

    if (emailOnlyDefault) {
      const result = await sendTestEmail({ to });
      return res.status(result.sent ? 200 : 502).json({
        ok: result.sent,
        mode: 'email_only',
        recipient: to,
        emailStatus: result.sent ? 'sent' : result.reason || 'send_failed',
        email: {
          sent: Boolean(result.sent),
          provider: result.provider || null,
          reason: result.reason || null,
          messageId: result.messageId || null,
          errorCode: result.errorCode || null,
          errorReason: result.errorReason || null,
          resendValidationHint: result.resendValidationHint || null,
        },
        emailConfig: result.config || getEmailConfigStatus(),
        via: 'public-test-secret',
      });
    }

    const user = await User.findOne({ email: to }).select(
      'username email savvyPoints pointsBalance membershipTier isPremium subscription loginStreakDays betaTester foundingAccess betaAccessExpiresAt'
    );
    if (!user) {
      return res.status(404).json({
        ok: false,
        message:
          'No account with that email. Register first, or call with ?emailOnly=true to send a template test without the full alert pipeline.',
      });
    }

    const forceEmail = String(req.query.forceEmail || req.body?.forceEmail || 'true').toLowerCase() === 'true';
    const skipEmail = String(req.query.skipEmail || req.body?.skipEmail || '').toLowerCase() === 'true';
    const result = await runAlertTestPipeline(user, { forceEmail, skipEmail });

    return res.status(result.ok ? 200 : 404).json({
      ...formatTestAlertResponse(user, result),
      mode: 'full_pipeline',
      via: 'public-test-secret',
    });
  } catch (err) {
    console.error('[test-alert/public] error:', err?.message || err);
    return res.status(500).json({
      ok: false,
      message: 'Public alert test failed.',
      error: String(err?.message || err).slice(0, 200),
    });
  }
});

/**
 * GET /api/test-alert/status — whether beta test mode is enabled.
 */
router.get('/status', auth, (req, res) => {
  res.json({
    enabled: testModeAllowed(),
    production: isProduction(),
    envFlag: isAlertTestModeEnabled(),
    searchTerms: require('../lib/alertTestModeConfig').PS5_SEARCH_TERMS,
    emailCooldownMinutes: 30,
    maxMatchingListings: require('../lib/alertTestModeConfig').MAX_MATCHING_LISTINGS,
  });
});

module.exports = router;
