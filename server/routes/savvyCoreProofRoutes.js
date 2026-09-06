const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const { isSavvyCoreEnabled } = require('../config/savvyCoreConfig');
const {
  isSavvyCoreProofEnabled,
  PROOF_SAVVY_AMOUNT,
} = require('../config/savvyCoreProofConfig');
const {
  getProofBootstrap,
  runReadParityCheck,
  awardProofSavvy,
  awardProofXp,
  progressProofContract,
  unlockProofCosmetic,
  verifyLedgerEntry,
  runSecurityNegativeTests,
  runFullProofFlow,
} = require('../services/savvyCore/savvyCoreProofService');

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
      code: 'SAVVY_CORE_DISABLED',
      message: 'Savvy Core V1 is not enabled. Set SAVVY_CORE_V1_ENABLED=true.',
    });
  }
  return next();
}

router.use(proofGate, auth, requireAdminAccess());

router.get('/bootstrap', async (req, res, next) => {
  try {
    const proofRunId = req.query.proofRunId ? String(req.query.proofRunId).trim() : undefined;
    const data = await getProofBootstrap(req.user, { proofRunId });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/parity', async (req, res, next) => {
  try {
    const result = await runReadParityCheck(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/award-savvy', async (req, res, next) => {
  try {
    const clientAmount = req.body?.amount;
    if (clientAmount != null && Number(clientAmount) !== PROOF_SAVVY_AMOUNT) {
      return res.status(400).json({
        pass: false,
        code: 'TAMPER_REJECTED',
        message: 'Client-provided amount rejected. Proof uses server-defined +50 Savvy only.',
        rejectedAmount: Number(clientAmount),
        canonicalAmount: PROOF_SAVVY_AMOUNT,
      });
    }
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const retry = Boolean(req.body?.retry);
    const result = await awardProofSavvy(req.user, proofRunId, { retry });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/award-xp', async (req, res, next) => {
  try {
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const result = await awardProofXp(req.user, proofRunId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/progress-contract', async (req, res, next) => {
  try {
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const result = await progressProofContract(req.user, proofRunId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/actions/unlock-cosmetic', async (req, res, next) => {
  try {
    const proofRunId = String(req.body?.proofRunId || '').trim();
    if (!proofRunId) {
      return res.status(400).json({ code: 'PROOF_RUN_ID_REQUIRED', message: 'proofRunId is required.' });
    }
    const result = await unlockProofCosmetic(req.user, proofRunId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/ledger/:proofRunId', async (req, res, next) => {
  try {
    const result = await verifyLedgerEntry(req.user, req.params.proofRunId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/security-tests', async (req, res, next) => {
  try {
    const result = await runSecurityNegativeTests(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/run-full', async (req, res, next) => {
  try {
    const proofRunId = req.body?.proofRunId ? String(req.body.proofRunId).trim() : undefined;
    const result = await runFullProofFlow(req.user, { proofRunId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
