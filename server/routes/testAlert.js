const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { isAlertTestModeEnabled } = require('../lib/alertTestModeConfig');
const { runAlertTestPipeline } = require('../services/alertTestModeService');
const { isProduction } = require('../config/envValidation');

const router = express.Router();

function testModeAllowed() {
  if (isAlertTestModeEnabled()) return true;
  return !isProduction();
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

    return res.status(result.ok ? 200 : 404).json({
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
      recipient: user.email ? `${String(user.email).slice(0, 3)}***` : null,
    });
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
