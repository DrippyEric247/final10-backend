const crypto = require('crypto');
const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  sendTestEmail,
  getEmailConfigStatus,
  getEmailEnvPresence,
  buildSavvyScoutDealFoundEmail,
  buildSavvyScoutMonthlyReportEmail,
  sendEarlyMonthlyReportTest,
} = require('../services/emailService');
const { sampleMonthlyReportData } = require('../templates/email/savvyScoutMonthlyReportTemplate');
const { requireAdminAccess } = require('../middleware/requireRole');
const { FOUNDER_ADMIN_EMAIL } = require('../lib/founderAdminAccess');
const { createEmailPipelineTrace } = require('../lib/emailPipelineTrace');
const { isProduction } = require('../config/envValidation');
const {
  maskEmail,
  buildEmailRouteExceptionBody,
  sendEmailRouteResult,
} = require('../lib/emailRouteUtils');

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

function jsonEmailTestResult(res, result, meta) {
  return sendEmailRouteResult(res, result, meta);
}

/**
 * GET /api/email/preview/deal-found
 * Returns HTML for the Savvy Scout deal notification (JWT or owner secret).
 */
router.get('/preview/deal-found', (req, res) => {
  const render = () => {
    try {
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
    } catch (err) {
      console.error('[email/preview/deal-found] render failed:', err?.message, err?.stack);
      return res.status(500).json(
        buildEmailRouteExceptionBody(err, { route: 'GET /api/email/preview/deal-found' })
      );
    }
  };

  if (grantSecretValid(req)) return render();
  return auth(req, res, () => render());
});

/**
 * GET /api/email/preview/monthly-report
 * Returns HTML for the Savvy Scout monthly report (JWT or owner secret).
 */
router.get('/preview/monthly-report', (req, res) => {
  const render = () => {
    try {
      const { html } = buildSavvyScoutMonthlyReportEmail(sampleMonthlyReportData());
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } catch (err) {
      console.error('[email/preview/monthly-report] render failed:', err?.message, err?.stack);
      return res.status(500).json(
        buildEmailRouteExceptionBody(err, { route: 'GET /api/email/preview/monthly-report' })
      );
    }
  };

  if (grantSecretValid(req)) return render();
  return auth(req, res, () => render());
});

/**
 * POST /api/email/test/monthly-report-early
 * Admin-only — sends early Monthly Scout Report with Savvy Scout Goals to founder.
 */
router.post('/test/monthly-report-early', auth, requireAdminAccess(), async (req, res) => {
  const trace = createEmailPipelineTrace();
  const isDev = !isProduction();
  const authenticatedUserId = String(req.user?._id || req.user?.id || '');
  const authenticatedUserEmail = String(req.user?.email || '').trim().toLowerCase();
  const recipientEmail = String(req.body?.to || FOUNDER_ADMIN_EMAIL).trim().toLowerCase();

  trace.step('endpoint_enter', {
    route: 'POST /api/email/test/monthly-report-early',
    authenticatedUserId,
    authenticatedUserEmail: maskEmail(authenticatedUserEmail),
    recipientEmail: maskEmail(recipientEmail),
  });

  const envPresent = getEmailEnvPresence();
  const config = getEmailConfigStatus();
  trace.step('env_check', {
    RESEND_API_KEY: envPresent.RESEND_API_KEY,
    EMAIL_FROM: envPresent.EMAIL_FROM,
    resolvedFromPresent: Boolean(config.emailFrom),
    resolvedFrom: config.emailFrom ? maskEmail(config.emailFrom) : null,
    recipientPresent: Boolean(recipientEmail),
    emailConfigured: config.emailConfigured,
    provider: config.provider,
  });

  console.log('[monthly-report-early] request', JSON.stringify({
    authenticatedUserId,
    authenticatedUserEmail: maskEmail(authenticatedUserEmail),
    recipientEmail: maskEmail(recipientEmail),
    envPresent,
    provider: config.provider,
    emailFromPresent: Boolean(config.emailFrom),
  }));

  try {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      trace.step('endpoint_stop', { ok: false, reason: 'missing_recipient' });
      return res.status(400).json({
        ok: false,
        reason: 'missing_recipient',
        message: 'Recipient email is required.',
        pipeline: trace.steps,
        ...(isDev && { devDetail: { envPresent, config } }),
      });
    }

    if (!envPresent.RESEND_API_KEY && !config.smtpConfigured) {
      trace.step('endpoint_stop', { ok: false, reason: 'email_not_configured' });
      return sendEmailRouteResult(
        res,
        { sent: false, ok: false, reason: 'email_not_configured', logOnly: true },
        { recipient: recipientEmail, pipeline: trace.steps, via: 'admin-early-monthly-report' }
      );
    }

    if (!config.emailFrom) {
      trace.step('endpoint_stop', { ok: false, reason: 'missing_from_address' });
      return sendEmailRouteResult(
        res,
        {
          sent: false,
          ok: false,
          reason: 'missing_from_address',
          errorReason: 'EMAIL_FROM is not configured or could not be resolved.',
        },
        { recipient: recipientEmail, pipeline: trace.steps, via: 'admin-early-monthly-report' }
      );
    }

    trace.step('monthly_report_send_invoke', { recipientEmail: maskEmail(recipientEmail) });
    const result = await sendEarlyMonthlyReportTest({
      to: recipientEmail,
      data: req.body?.data || {},
      trace,
    });

    return jsonEmailTestResult(res, result, {
      recipient: recipientEmail,
      via: 'admin-early-monthly-report',
      template: 'monthly_report_early',
      pipeline: trace.steps,
      authenticatedUserId,
    });
  } catch (err) {
    console.error('[monthly-report-early] exception', {
      message: err?.message,
      stack: err?.stack,
      authenticatedUserId,
      recipientEmail: maskEmail(recipientEmail),
    });
    trace.step('endpoint_exception', {
      ok: false,
      phase: 'monthly_report_early',
      message: String(err?.message || err).slice(0, 500),
      ...(isDev && { stack: String(err?.stack || '').split('\n').slice(0, 12) }),
    });

    return res.status(500).json(
      buildEmailRouteExceptionBody(err, {
        reason: 'monthly_report_exception',
        route: 'POST /api/email/test/monthly-report-early',
        pipeline: trace.steps,
        recipient: recipientEmail,
        authenticatedUserId,
      })
    );
  }
});

/**
 * POST /api/email/test
 * Send a test email. Body: { "to": "you@example.com", "template": "deal" | "monthly_report" }
 * Auth: Bearer JWT (own email only) OR X-Owner-Grant-Secret (any recipient).
 */
router.post('/test', async (req, res) => {
  try {
    const bodyTo = String(req.body?.to || '').trim().toLowerCase();
    const template = String(req.body?.template || req.query?.template || 'deal').trim().toLowerCase();

    if (grantSecretValid(req)) {
      if (!bodyTo) {
        return res.status(400).json({
          ok: false,
          code: 'BAD_REQUEST',
          message: 'Body field "to" is required',
        });
      }
      const result = await sendTestEmail({ to: bodyTo, template });
      return jsonEmailTestResult(res, result, {
        recipient: bodyTo,
        via: 'owner-grant-secret',
      });
    }

    return auth(req, res, async () => {
      try {
        const user = await User.findById(req.user._id || req.user.id).select('email');
        if (!user) {
          return res.status(404).json({
            ok: false,
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        const recipient = (bodyTo || user.email || '').trim().toLowerCase();
        if (!recipient) {
          return res.status(400).json({
            ok: false,
            code: 'BAD_REQUEST',
            message: 'No email on account; pass "to" in body',
          });
        }
        if (bodyTo && bodyTo !== String(user.email || '').trim().toLowerCase()) {
          return res.status(403).json({
            ok: false,
            code: 'FORBIDDEN',
            message: 'JWT test emails may only be sent to your own account email',
          });
        }

        const result = await sendTestEmail({ to: recipient, template });
        return jsonEmailTestResult(res, result, {
          recipient,
          via: 'jwt',
        });
      } catch (err) {
        console.error('[email/test] jwt branch failed:', err?.message, err?.stack);
        return res.status(500).json(
          buildEmailRouteExceptionBody(err, { route: 'POST /api/email/test', via: 'jwt' })
        );
      }
    });
  } catch (err) {
    console.error('[email/test] failed:', err?.message, err?.stack);
    return res.status(500).json(
      buildEmailRouteExceptionBody(err, { route: 'POST /api/email/test' })
    );
  }
});

module.exports = router;
