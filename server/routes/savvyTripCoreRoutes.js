const express = require('express');
const auth = require('../middleware/auth');
const { isSavvyCoreEnabled } = require('../config/savvyCoreConfig');
const { readSavvyTripCoreAccount, SavvyTripCoreAdapterError } = require('../services/savvyCore/savvyTripCoreAdapter');

const router = express.Router();

function gate(_req, res, next) {
  if (!isSavvyCoreEnabled()) {
    return res.status(503).json({
      code: 'SAVVY_CORE_UNAVAILABLE',
      message: 'SAVVY CORE TEMPORARILY UNAVAILABLE',
    });
  }
  return next();
}

function handleAdapterError(err, res, next) {
  if (err instanceof SavvyTripCoreAdapterError) {
    return res.status(err.status || 400).json({
      code: err.code || 'SAVVYTRIP_CORE_ERROR',
      message: err.message,
      ...(err.details || {}),
    });
  }
  return next(err);
}

router.get('/health', (_req, res) => {
  res.json({
    sourceApp: 'savvytrip',
    savvyCoreEnabled: isSavvyCoreEnabled(),
    ok: isSavvyCoreEnabled(),
  });
});

router.get('/account', gate, auth, async (req, res, next) => {
  try {
    const account = await readSavvyTripCoreAccount(req.user);
    res.json(account);
  } catch (err) {
    handleAdapterError(err, res, next);
  }
});

module.exports = router;
