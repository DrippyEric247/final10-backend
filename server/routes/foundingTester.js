const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  getProgressSnapshot,
  attestTask,
  completeMission,
} = require('../services/foundingTesterService');

const router = express.Router();

router.get('/progress', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });
    const snapshot = await getProgressSnapshot(user);
    return res.json(snapshot);
  } catch (err) {
    console.error('[foundingTester] progress error:', err?.message);
    return res.status(500).json({ ok: false, message: 'Could not load Founding Tester progress.' });
  }
});

router.post('/attest-task', auth, async (req, res) => {
  try {
    const missionId = String(req.body?.missionId || '').trim();
    if (!missionId) return res.status(400).json({ ok: false, message: 'missionId is required.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });

    const result = await attestTask(user, missionId);
    if (!result.ok) {
      const status = result.code === 'DAY_LOCKED' ? 409 : 400;
      return res.status(status).json(result);
    }
    const snapshot = await getProgressSnapshot(user);
    return res.json({ ...result, snapshot });
  } catch (err) {
    console.error('[foundingTester] attest error:', err?.message);
    return res.status(500).json({ ok: false, message: 'Could not attest task.' });
  }
});

router.post('/complete', auth, async (req, res) => {
  try {
    const missionId = String(req.body?.missionId || '').trim();
    const feedback = String(req.body?.feedback || '');
    if (!missionId) return res.status(400).json({ ok: false, message: 'missionId is required.' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });

    const result = await completeMission(user, { missionId, feedback });
    if (!result.ok) {
      const status =
        result.code === 'ALREADY_COMPLETE' ? 409 :
        result.code === 'DAY_LOCKED' || result.code === 'DAILY_LIMIT' ? 409 : 400;
      return res.status(status).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[foundingTester] complete error:', err?.message);
    return res.status(500).json({ ok: false, message: 'Could not complete mission.' });
  }
});

module.exports = router;
