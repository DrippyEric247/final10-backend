const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { isProduction } = require('../config/envValidation');
const { createEmailPipelineTrace } = require('../lib/emailPipelineTrace');
const {
  buildEmailRouteExceptionBody,
  maskEmail,
  sendEmailRouteResult,
} = require('../lib/emailRouteUtils');
const {
  AdminEmailTestError,
  searchUsers,
  getUserById,
  getUserTestHistory,
  sendAdminTestEmail,
  listTemplates,
} = require('../services/adminEmailTestService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

function adminEmailJsonError(res, err, meta = {}) {
  if (err instanceof AdminEmailTestError) {
    const status = err.status >= 500 ? 200 : err.status;
    return res.status(status).json({
      ok: false,
      code: err.code,
      message: err.message,
      failureReason: err.message,
      ...err.extra,
      ...meta,
    });
  }

  console.error('[admin/email-test] unhandled error:', err?.message, err?.stack);
  return res.status(500).json(
    buildEmailRouteExceptionBody(err, {
      code: 'SEND_FAILED',
      reason: 'admin_email_test_exception',
      route: 'POST /api/admin/email-test/send',
      ...meta,
    })
  );
}

router.get('/ping', auth, requireAdminAccess(), (req, res) => {
  res.json({ ok: true, service: 'admin-email-test' });
});

router.get('/templates', auth, requireAdminAccess(), (req, res) => {
  res.json({ ok: true, templates: listTemplates() });
});

router.get('/users', auth, requireAdminAccess(), async (req, res) => {
  try {
    const users = await searchUsers(req.query.q || req.query.query);
    res.json({ ok: true, users });
  } catch (err) {
    return adminEmailJsonError(res, err, { route: 'GET /api/admin/email-test/users' });
  }
});

router.get('/users/:userId', auth, requireAdminAccess(), async (req, res) => {
  try {
    const user = await getUserById(req.params.userId);
    res.json({ ok: true, user });
  } catch (err) {
    return adminEmailJsonError(res, err, { route: 'GET /api/admin/email-test/users/:userId' });
  }
});

router.get('/users/:userId/history', auth, requireAdminAccess(), async (req, res) => {
  try {
    const history = await getUserTestHistory(req.params.userId);
    res.json({ ok: true, history });
  } catch (err) {
    return adminEmailJsonError(res, err, { route: 'GET /api/admin/email-test/users/:userId/history' });
  }
});

router.post('/send', auth, requireAdminAccess(), upload.single('image'), async (req, res) => {
  const trace = createEmailPipelineTrace();
  const isDev = !isProduction();
  const authenticatedUserId = String(req.adminUser?._id || req.user?._id || req.user?.id || '');
  const authenticatedUserEmail = String(req.adminUser?.email || req.user?.email || '').trim().toLowerCase();

  trace.step('endpoint_enter', {
    route: 'POST /api/admin/email-test/send',
    authenticatedUserId,
    authenticatedUserEmail: maskEmail(authenticatedUserEmail),
  });

  try {
    const templateKey = String(req.body.templateKey || '').trim();
    const userId = String(req.body.userId || '').trim();

    trace.step('request_parsed', { templateKey, userId: userId || null });

    if (!userId) {
      trace.step('endpoint_stop', { ok: false, reason: 'missing_user_id' });
      return res.status(400).json({
        ok: false,
        code: 'USER_REQUIRED',
        message: 'userId is required.',
        pipeline: trace.steps,
      });
    }

    let imageUrl = String(req.body.imageUrl || '').trim();
    if (req.file?.buffer) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      trace.step('image_attached', { mime: req.file.mimetype, bytes: req.file.buffer.length });
    }

    const custom = {
      subject: req.body.customSubject || req.body.subject,
      message: req.body.customMessage || req.body.message,
      buttonText: req.body.buttonText,
      buttonUrl: req.body.buttonUrl,
      imageUrl,
    };

    const result = await sendAdminTestEmail({
      userId,
      templateKey,
      custom,
      adminUser: req.adminUser || req.user,
      trace,
    });

    console.log('[admin/email-test] send result', JSON.stringify({
      ok: result.ok,
      code: result.code || null,
      status: result.status || null,
      reason: result.reason || null,
      errorReason: result.errorReason || null,
      provider: result.provider || null,
      templateKey,
      userId,
    }));

    return sendEmailRouteResult(res, result, {
      pipeline: trace.steps,
      authenticatedUserId,
      via: 'admin-email-test-center',
      ...(isDev && result.ok === false
        ? {
            devNote:
              'Delivery failures return HTTP 200 with ok:false so the browser always receives JSON.',
          }
        : {}),
    });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be under 2 MB.'
          : 'Invalid image upload.';
      trace.step('multer_error', { code: err.code, message });
      return res.status(400).json({
        ok: false,
        code: 'INVALID_IMAGE',
        message,
        pipeline: trace.steps,
      });
    }

    trace.step('endpoint_exception', {
      ok: false,
      message: String(err?.message || err).slice(0, 500),
      ...(isDev && { stack: String(err?.stack || '').split('\n').slice(0, 12) }),
    });

    return adminEmailJsonError(res, err, { pipeline: trace.steps });
  }
});

module.exports = router;
