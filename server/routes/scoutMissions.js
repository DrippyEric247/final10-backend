const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { claimScoutMissionReward } = require('../services/scoutMissionService');
const { getMissionProgressSnapshot } = require('../services/scoutMissionProgressService');
const { scoutMissionClaimLimiter } = require('../middleware/rateLimits');

const router = express.Router();

/** GET /api/scout-missions/progress — server-authoritative completion state. */
router.get('/progress', auth, async (req, res) => {
  try {
    const progress = await getMissionProgressSnapshot(req.user.id);
    return res.json({ ok: true, progress });
  } catch (err) {
    console.error('[scoutMissions] progress error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not load mission progress.' });
  }
});

/** POST /api/scout-missions/record-action — validated client sync; server hooks remain authoritative. */
router.post('/record-action', auth, scoutMissionClaimLimiter, async (req, res) => {
  try {
    const trigger = String(req.body?.trigger || '').trim();
    const increment = Math.max(1, Math.round(Number(req.body?.increment) || 1));
    const idempotencyKey = String(req.body?.idempotencyKey || '').trim();

    if (!trigger) {
      return res.status(400).json({ ok: false, code: 'MISSING_TRIGGER', message: 'trigger is required.' });
    }

    const {
      isKnownScoutTrigger,
      isServerVerifiableTrigger,
    } = require('../config/scoutMissionTriggers');

    if (!isKnownScoutTrigger(trigger)) {
      return res.status(400).json({ ok: false, code: 'UNSUPPORTED_ACTION', message: 'Unknown scout action.' });
    }

    if (isServerVerifiableTrigger(trigger)) {
      return res.status(400).json({
        ok: false,
        code: 'SCOUT_USE_SERVER_HOOK',
        message: 'This scout action must be recorded by the server.',
      });
    }

    if (req.body?.rewardAmount != null || req.body?.completed === true) {
      return res.status(400).json({
        ok: false,
        code: 'CLIENT_REWARD_REJECTED',
        message: 'Clients cannot submit reward amounts or completion flags.',
      });
    }

    const { recordScoutMissionTrigger, getMissionProgressSnapshot } = require('../services/scoutMissionProgressService');
    const completed = await recordScoutMissionTrigger(req.user.id, trigger, {
      increment,
      source: 'client',
      idempotencyKey: idempotencyKey || null,
      allowClientObservable: true,
      warnServerVerifiableFromClient: isServerVerifiableTrigger(trigger),
    });
    const progress = await getMissionProgressSnapshot(req.user.id);
    return res.json({ ok: true, completed, progress });
  } catch (err) {
    if (err?.code === 'SCOUT_ACTION_RATE_LIMIT') {
      return res.status(429).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('[scoutMissions] record-action error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not record mission action.' });
  }
});

/** POST /api/scout-missions/claim — grant Savvy for a completed mission (idempotent). */
router.post('/claim', auth, scoutMissionClaimLimiter, async (req, res) => {
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

    if (result.error === 'mission_not_complete') {
      return res.status(403).json(result);
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
