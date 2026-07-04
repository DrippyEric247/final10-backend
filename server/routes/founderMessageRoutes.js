const express = require('express');
const multer = require('multer');
const optionalUserAuth = require('../middleware/optionalUserAuth');
const { founderMessageLimiter } = require('../middleware/rateLimits');
const {
  submitFounderMessage,
  FounderMessageError,
} = require('../services/founderMessageService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

router.post('/', founderMessageLimiter, optionalUserAuth, upload.single('screenshot'), async (req, res) => {
  try {
    const result = await submitFounderMessage(req.body || {}, {
      user: req.user,
      ip: req.ip,
      screenshot: req.file || null,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Screenshot must be under 2 MB.'
          : 'Invalid screenshot upload.';
      return res.status(400).json({ success: false, code: 'INVALID_SCREENSHOT', message });
    }
    if (err instanceof FounderMessageError) {
      return res.status(err.status).json({ success: false, code: err.code, message: err.message });
    }
    console.error('[founder-messages] submit failed:', err?.message);
    res.status(500).json({
      success: false,
      code: 'SUBMIT_FAILED',
      message: 'Savvy Scout could not deliver your message. Please try again shortly.',
    });
  }
});

module.exports = router;
