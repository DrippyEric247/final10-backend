const express = require('express');
const auth = require('../middleware/auth');
const {
  getScarcityStatus,
  getHallSnapshot,
  getMemberDetail,
  getLegacyForUser,
  tryAssignFounderSlot,
} = require('../services/foundingBetaService');
const User = require('../models/User');

const router = express.Router();

router.get('/status', async (_req, res) => {
  try {
    const status = await getScarcityStatus();
    res.json({ ok: true, ...status });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.message || 'Failed to load founder status.' });
  }
});

router.get('/hall', async (_req, res) => {
  try {
    const hall = await getHallSnapshot();
    res.json({ ok: true, ...hall });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.message || 'Failed to load Founding Hall.' });
  }
});

router.get('/hall/:slot', async (req, res) => {
  try {
    const detail = await getMemberDetail(Number(req.params.slot));
    if (!detail) return res.status(404).json({ ok: false, message: 'Founder slot not claimed.' });
    res.json({ ok: true, member: detail });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.message || 'Failed to load founder.' });
  }
});

router.get('/legacy', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });
    if (!user.founderNumber) {
      await tryAssignFounderSlot(user);
    }
    const legacy = await getLegacyForUser(req.user.id);
    const status = await getScarcityStatus();
    res.json({ ok: true, legacy, scarcity: status });
  } catch (err) {
    res.status(500).json({ ok: false, message: err?.message || 'Failed to load legacy.' });
  }
});

module.exports = router;
