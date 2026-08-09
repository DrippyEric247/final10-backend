const express = require('express');
const auth = require('../middleware/auth');
const { getDealStreakStatusForUser, acknowledgeNukeCelebration } = require('../services/dealStreakService');

const router = express.Router();

/** GET /api/deal-streak/status — account deal streak + nuke category challenges. */
router.get('/status', auth, async (req, res) => {
  try {
    const status = await getDealStreakStatusForUser(req.user.id);
    return res.json({ ok: true, ...status });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('[deal-streak] status error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not load deal streak status.' });
  }
});

/** POST /api/deal-streak/ack-celebration — dismiss Nuke completion modal. */
router.post('/ack-celebration', auth, async (req, res) => {
  try {
    const status = await acknowledgeNukeCelebration(req.user.id);
    return res.json({ ok: true, ...status });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, code: err.code, message: err.message });
    }
    console.error('[deal-streak] ack error:', err?.message || err);
    return res.status(500).json({ ok: false, message: 'Could not acknowledge celebration.' });
  }
});

module.exports = router;
