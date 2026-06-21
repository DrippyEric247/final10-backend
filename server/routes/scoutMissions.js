const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { claimScoutMissionReward } = require('../services/scoutMissionService');

const router = express.Router();

/** POST /api/scout-missions/claim — grant Savvy for a completed mission (idempotent). */
router.post('/claim', auth, async (req, res) => {
  try {
    const missionId = String(req.body?.missionId || '').trim();
    const periodKey = String(req.body?.periodKey || '').trim();

    if (!missionId) {
      return res.status(400).json({ ok: false, message: 'missionId is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found.' });
    }

    const result = await claimScoutMissionReward(user, { missionId, periodKey });

    if (result.error === 'invalid_mission') {
      return res.status(400).json(result);
    }

    if (result.alreadyClaimed) {
      return res.status(409).json(result);
    }

    if (!result.granted) {
      return res.status(500).json({ ...result, message: result.message || 'Claim failed.' });
    }

    return res.json(result);
  } catch (err) {
    console.error('[scoutMissions] claim error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not claim mission reward.' });
  }
});

module.exports = router;
