// server/routes/config.js
const express = require('express');
const router = express.Router();
const { getPublicConfig } = require('../config/public');
const { getServerTimePayload } = require('../lib/serverTime');

router.get('/public', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=600');
  res.json(getPublicConfig());
});

/** UTC day/week boundaries — use for daily/weekly reset UI sync with server clock. */
router.get('/time', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getServerTimePayload());
});

// ⬅️ EXACTLY this line (no braces, no default, no typo)
module.exports = router;


