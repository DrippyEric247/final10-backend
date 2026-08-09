const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  getEggCamoCollectionState,
  acknowledgeEggCamoCelebrations,
} = require('../services/eggCamoProgressService');

const router = express.Router();

/** Full Egg Camo Collection state for the authenticated user. */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const state = await getEggCamoCollectionState(user);
    return res.json(state);
  } catch (err) {
    console.error('[egg-camo] GET /me failed', err);
    return res.status(500).json({ error: 'Failed to load Egg Camo Collection' });
  }
});

/** Clear pending first-unlock celebration flags after the client shows them. */
router.post('/celebrations/ack', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const camoIds = req.body?.camoIds;
    const state = await acknowledgeEggCamoCelebrations(user, camoIds);
    return res.json(state);
  } catch (err) {
    console.error('[egg-camo] POST /celebrations/ack failed', err);
    return res.status(500).json({ error: 'Failed to acknowledge celebrations' });
  }
});

module.exports = router;
