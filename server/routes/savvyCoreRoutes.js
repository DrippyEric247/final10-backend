const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { requireTrustedApp } = require('../middleware/savvyCoreAppAuth');
const {
  isSavvyCoreEnabled,
  isSavvyCoreExternalWritesEnabled,
  SAVVY_CORE_VERSION,
  listRegisteredApps,
  validateAppId,
} = require('../config/savvyCoreConfig');
const { isSavvyCoreProofEnabled } = require('../config/savvyCoreProofConfig');
const { getServerCommitSha } = require('../lib/deploySha');
const { verifySavvyCoreHandlers, SAVVY_CORE_REWARD_SOURCES } = require('../services/savvyCore/savvyCoreHandlerCheck');
const { getSavvyCoreMe } = require('../services/savvyCore/savvyCoreProfileService');
const { getSavvyBalance } = require('../services/savvyCore/savvyCoreWalletService');
const { getAccountProgression } = require('../services/savvyCore/savvyCoreProgressionService');
const { earnSavvy, spendSavvy } = require('../services/savvyCore/savvyCoreWalletService');
const { awardAccountXP } = require('../services/savvyCore/savvyCoreProgressionService');
const { grantReward, REWARD_FAMILIES } = require('../services/savvyCore/savvyCoreRewardService');
const { progressAppContracts } = require('../services/savvyCore/savvyCoreContractService');
const { unlockCosmetic } = require('../services/savvyCore/savvyCoreCosmeticService');
const { recordSavvyEvent } = require('../services/savvyCore/savvyCoreEventService');
const { runSavvyTripTestFlow, runGameSavvyTestFlow } = require('../services/savvyCore/savvyCoreIntegrationTest');
const {
  SavvyCoreWalletError,
} = require('../services/savvyCore/savvyCoreWalletService');
const {
  SavvyCoreProgressionError,
} = require('../services/savvyCore/savvyCoreProgressionService');
const {
  SavvyCoreRewardError,
} = require('../services/savvyCore/savvyCoreRewardService');
const {
  SavvyCoreContractError,
} = require('../services/savvyCore/savvyCoreContractService');
const {
  SavvyCoreCosmeticError,
} = require('../services/savvyCore/savvyCoreCosmeticService');

const router = express.Router();

function gate(_req, res, next) {
  if (!isSavvyCoreEnabled()) {
    return res.status(503).json({ code: 'SAVVY_CORE_DISABLED', message: 'Savvy Core V1 is not enabled.' });
  }
  return next();
}

function handleError(err, res, next) {
  const known = [
    SavvyCoreWalletError,
    SavvyCoreProgressionError,
    SavvyCoreRewardError,
    SavvyCoreContractError,
    SavvyCoreCosmeticError,
  ];
  if (known.some((Cls) => err instanceof Cls) || err.code?.startsWith('SAVVY_CORE')) {
    return res.status(err.status || 500).json({
      code: err.code || 'SAVVY_CORE_ERROR',
      message: err.message,
      ...(err.details || {}),
    });
  }
  return next(err);
}

router.get('/health', (_req, res) => {
  const check = verifySavvyCoreHandlers({ failOnError: false });
  res.json({
    version: SAVVY_CORE_VERSION,
    enabled: isSavvyCoreEnabled(),
    savvyCoreV1Enabled: isSavvyCoreEnabled(),
    savvyCoreProofEnabled: isSavvyCoreProofEnabled(),
    externalWritesEnabled: isSavvyCoreExternalWritesEnabled(),
    serverCommitSha: getServerCommitSha() || null,
    environment: process.env.NODE_ENV || 'development',
    registeredApps: listRegisteredApps(),
    registeredRewardHandlers: SAVVY_CORE_REWARD_SOURCES,
    rewardFamilies: REWARD_FAMILIES,
    walletReady: check.grantSavvyReward === 'function' && check.spendSavvyReward === 'function',
    progressionReady: true,
    contractsReady: true,
    idempotencyReady: true,
    allValid: check.allValid,
  });
});

router.get('/me', gate, auth, async (req, res, next) => {
  try {
    const me = await getSavvyCoreMe(req.user);
    res.json(me);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/wallet', gate, auth, async (req, res, next) => {
  try {
    const wallet = await getSavvyBalance({ userId: req.user._id });
    res.json(wallet);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.get('/progression', gate, auth, async (req, res, next) => {
  try {
    const progression = await getAccountProgression({ userId: req.user._id });
    res.json(progression);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/rewards/grant', gate, requireTrustedApp, async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ code: 'USER_ID_REQUIRED', message: 'userId is required for trusted app grants.' });
    const result = await grantReward({
      userId,
      appId: req.savvyApp.appId,
      rewardType: req.body?.rewardType,
      amount: req.body?.amount,
      rewardId: req.body?.rewardId,
      metadata: req.body?.metadata,
      source: req.body?.source,
      idempotencyKey: req.body?.idempotencyKey,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/wallet/earn', gate, requireTrustedApp, async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ code: 'USER_ID_REQUIRED', message: 'userId is required.' });
    const result = await earnSavvy({
      userId,
      amount: req.body?.amount,
      sourceApp: req.savvyApp.appId,
      reason: req.body?.reason,
      metadata: req.body?.metadata,
      idempotencyKey: req.body?.idempotencyKey,
      activityType: req.body?.activityType,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/xp/award', gate, requireTrustedApp, async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ code: 'USER_ID_REQUIRED', message: 'userId is required.' });
    const result = await awardAccountXP({
      userId,
      amount: req.body?.amount,
      sourceApp: req.savvyApp.appId,
      activityType: req.body?.activityType,
      metadata: req.body?.metadata,
      idempotencyKey: req.body?.idempotencyKey,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/contracts/progress', gate, requireTrustedApp, async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ code: 'USER_ID_REQUIRED', message: 'userId is required.' });
    const result = await progressAppContracts({
      userId,
      sourceApp: req.savvyApp.appId,
      trigger: req.body?.trigger,
      increment: req.body?.increment,
      metadata: req.body?.metadata,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/cosmetics/unlock', gate, requireTrustedApp, async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ code: 'USER_ID_REQUIRED', message: 'userId is required.' });
    const result = await unlockCosmetic({
      userId,
      cosmeticId: req.body?.cosmeticId,
      sourceApp: req.savvyApp.appId,
      sourceType: req.body?.sourceType,
      metadata: req.body?.metadata,
      idempotencyKey: req.body?.idempotencyKey,
      scopeType: req.body?.scopeType,
      scopeId: req.body?.scopeId,
      globalEquipEligible: req.body?.globalEquipEligible,
    });
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/events/emit', gate, requireTrustedApp, async (req, res, next) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ code: 'USER_ID_REQUIRED', message: 'userId is required.' });
    const envelope = await recordSavvyEvent({
      userId,
      appId: req.savvyApp.appId,
      type: req.body?.type,
      metadata: req.body?.metadata,
    });
    res.json({ envelope });
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/internal/test/savvytrip', gate, auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await runSavvyTripTestFlow(req.user, req.body || {});
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

router.post('/internal/test/gamesavvy', gate, auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await runGameSavvyTestFlow(req.user, req.body || {});
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
});

module.exports = router;
