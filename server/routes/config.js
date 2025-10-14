// server/routes/config.js
const express = require('express');
const router = express.Router();
const { getPublicConfig } = require('../config/public');

router.get('/public', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=600');
  res.json(getPublicConfig());
});

// ⬅️ EXACTLY this line (no braces, no default, no typo)
module.exports = router;


