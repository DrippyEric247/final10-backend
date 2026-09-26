const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { isSavvyCoreEnabled } = require('../config/savvyCoreConfig');
const { isSavvyCoreProofEnabled } = require('../config/savvyCoreProofConfig');
const { SAVVYTRIP_PROOF_SAVVY_AMOUNT } = require('../config/savvyTripAppProofConfig');
const {
  getSavvyTripProofBootstrap,
  activateConfiguredProofTestSubject,
  runReadParityCheckForUser,
  awardSavvyTripProofSavvy,
  awardSavvyTripProofXp,
  progressSavvyTripProofContract,
  unlockSavvyTripProofCosmetic,
  verifySavvyTripProofLedger,
  runSavvyTripSecurityNegativeTests,
  runSavvyTripFullProof,
  resolveProofContext,
  assertProofMutationsAllowed,
} = require('../services/savvyCore/savvyTripAppProofService');

const router = express.Router();

function proofGate(_req, res, next) {
  if (!isSavvyCoreProofEnabled()) {
    return res.status(503).json({
      code: 'SAVVY_CORE_PROOF_DISABLED',
      message: 'Savvy Core production proof is disabled. Set SAVVY_CORE_PROOF_ENABLED=true.',
    });
  }
  if (!isSavvyCoreEnabled()) {
    return res.status(503).json({
      code: 'SAVVY_CORE_UNAVAILABLE',
      message: 'SAVVY CORE TEMPORARILY UNAVAILABLE',
    });
  }
  return next();
}

async function attachProofMutationTarget(req, res, next) {
  try {
    const context = await resolveProofContext(req.user);
    req.proofContext = context;
    req.proofTestUser = assertProofMutationsAllowed(context);
    return next();
  } catch (err) {
    return res.status(err.status || 503).json({
      code: err.code || 'PROOF_MUTATIONS_DISABLED',
      message: err.message,
    });
  }
}

router.use(proofGate, auth, requireAdminAccess());

router.get('/bootstrap', async (req, res, next) => {
  try {
    const proofRunId = req.query.proofRunId ? String(req.query.proofRunId).trim() : undefined;
    const data = await getSavvyTripProofBootstrap(req.user, { proofRunId });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/activate-test-subject', async (req, res, next) => {
  try {
    const result = await activateConfiguredProofTestSubject(req.user);
    const bootstrap = await getSavvyTripProofBootstrap(req.user);
    res.json({ ...result, bootstrap });
  } catch (err) {
    next(err);
  }
});

router.post('/parity', async (req, res, next) => {
  try {
    const context = await resolveProofContext(req.user);
    if (!context.testSubjectUser) {
      return res.json({
        pass: false,
        code: 'PROOF_TEST_SUBJECT_NOT_CONFIGURED',
        message: context.blockReason || 'Proof test subject is not configured.',
        comparison: [],
      });
    }
    const result = await runReadParityCheckForUser(context.testSubjectUser);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/award-savvy', attachProofMutationTarget, async (req, res, next) => {
  try {
    const clientAmount = req.body?.amount;
    if (clientAmount != null && Number(clientAmount) !== SAVVYTRIP_PROOF_SAVVY_AMOUNT) {
      return res.status(400).json({
        pass: false,
        code: 'TAMPER_REJECTED',
        message: 'Client-provided amount rejected. Proof uses server-defined +10 Savvy only.',
        rejectedAmount: Number(clientAmount),
        canonicalAmount: SAVVYTRIP_PROOF_SAVVY_AMOUNT,
      });
    }
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const retry = Boolean(req.body?.retry);
    const result = await awardSavvyTripProofSavvy(req.proofTestUser, proofRunId, {
      retry,
      operatorUserId: req.user._id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/award-xp', attachProofMutationTarget, async (req, res, next) => {
  try {
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const result = await awardSavvyTripProofXp(req.proofTestUser, proofRunId, {
      operatorUserId: req.user._id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/progress-contract', attachProofMutationTarget, async (req, res, next) => {
  try {
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const result = await progressSavvyTripProofContract(req.proofTestUser, proofRunId, {
      operatorUserId: req.user._id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/unlock-cosmetic', attachProofMutationTarget, async (req, res, next) => {
  try {
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const result = await unlockSavvyTripProofCosmetic(req.proofTestUser, proofRunId, {
      operatorUserId: req.user._id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/ledger/:proofRunId', attachProofMutationTarget, async (req, res, next) => {
  try {
    const result = await verifySavvyTripProofLedger(req.proofTestUser, req.params.proofRunId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/security-tests', attachProofMutationTarget, async (req, res, next) => {
  try {
    const result = await runSavvyTripSecurityNegativeTests(req.proofTestUser, {
      operatorUserId: req.user._id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/run-full', attachProofMutationTarget, async (req, res, next) => {
  try {
    const proofRunId = req.body?.proofRunId ? String(req.body.proofRunId).trim() : undefined;
    const result = await runSavvyTripFullProof(req.user, { proofRunId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
