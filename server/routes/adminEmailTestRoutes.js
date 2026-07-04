const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
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
    if (err instanceof AdminEmailTestError) {
      return res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('[admin/email-test] search failed:', err?.message);
    res.status(500).json({ ok: false, code: 'SEARCH_FAILED', message: 'User search failed.' });
  }
});

router.get('/users/:userId', auth, requireAdminAccess(), async (req, res) => {
  try {
    const user = await getUserById(req.params.userId);
    res.json({ ok: true, user });
  } catch (err) {
    if (err instanceof AdminEmailTestError) {
      return res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('[admin/email-test] user lookup failed:', err?.message);
    res.status(500).json({ ok: false, code: 'USER_LOOKUP_FAILED', message: 'User lookup failed.' });
  }
});

router.get('/users/:userId/history', auth, requireAdminAccess(), async (req, res) => {
  try {
    const history = await getUserTestHistory(req.params.userId);
    res.json({ ok: true, history });
  } catch (err) {
    if (err instanceof AdminEmailTestError) {
      return res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('[admin/email-test] history failed:', err?.message);
    res.status(500).json({ ok: false, code: 'HISTORY_FAILED', message: 'Could not load email history.' });
  }
});

router.post('/send', auth, requireAdminAccess(), upload.single('image'), async (req, res) => {
  try {
    const templateKey = String(req.body.templateKey || '').trim();
    const userId = String(req.body.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ ok: false, code: 'USER_REQUIRED', message: 'userId is required.' });
    }

    let imageUrl = String(req.body.imageUrl || '').trim();
    if (req.file?.buffer) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
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
    });

    res.json(result);
  } catch (err) {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be under 2 MB.'
          : 'Invalid image upload.';
      return res.status(400).json({ ok: false, code: 'INVALID_IMAGE', message });
    }
    if (err instanceof AdminEmailTestError) {
      return res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('[admin/email-test] send failed:', err?.message);
    res.status(500).json({ ok: false, code: 'SEND_FAILED', message: 'Could not send test email.' });
  }
});

module.exports = router;
