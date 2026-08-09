const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { DEFAULT_CONTRACTS_APP_ID } = require('../config/contracts');
const { getContractsHubForUser, claimContractReward } = require('../services/contractService');
const { recordContractAppOpen } = require('../services/contractProgressService');
const { scoutMissionClaimLimiter } = require('../middleware/rateLimits');

const router = express.Router();

/** GET /api/contracts/hub?appId=final10 — app-scoped contract dashboard. */
router.get('/hub', auth, async (req, res) => {
  try {
    const appId = String(req.query?.appId || DEFAULT_CONTRACTS_APP_ID).trim();
    const hub = await getContractsHubForUser(req.user.id, appId);
    return res.json({ ok: true, ...hub });
  } catch (err) {
    console.error('[contracts] hub error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not load contracts.' });
  }
});

/** POST /api/contracts/claim — grant reward for a completed contract (idempotent). */
router.post('/claim', auth, scoutMissionClaimLimiter, async (req, res) => {
  try {
    const contractId = String(req.body?.contractId || '').trim();
    const sourceAppId = String(req.body?.appId || DEFAULT_CONTRACTS_APP_ID).trim();

    if (!contractId) {
      return res.status(400).json({ ok: false, message: 'contractId is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found.' });
    }

    const result = await claimContractReward(user, { contractId, sourceAppId });

    if (result.error === 'invalid_contract') {
      return res.status(400).json(result);
    }
    if (result.error === 'contract_not_complete') {
      return res.status(403).json(result);
    }
    if (result.alreadyClaimed) {
      return res.status(409).json(result);
    }
    if (result.error === 'contract_expired') {
      return res.status(410).json(result);
    }
    if (!result.granted) {
      return res.status(500).json({ ...result, message: result.message || 'Claim failed.' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[contracts] claim error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not claim contract reward.' });
  }
});

/** POST /api/contracts/record-app-open — heartbeat for cross-app universe contracts. */
router.post('/record-app-open', auth, async (req, res) => {
  try {
    const appId = String(req.body?.appId || DEFAULT_CONTRACTS_APP_ID).trim();
    await recordContractAppOpen(req.user.id, appId);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[contracts] record-app-open error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not record app open.' });
  }
});

module.exports = router;
