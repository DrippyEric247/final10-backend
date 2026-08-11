const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { getEggKeychainCollectionState } = require('../services/eggKeychainService');

const router = express.Router();

/** Full Egg Keychain Collection state for the authenticated user. */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const state = await getEggKeychainCollectionState(user);
    return res.json(state);
  } catch (err) {
    console.error('[egg-keychains] GET /me failed', err);
    return res.status(500).json({ error: 'Failed to load Egg Keychain Collection' });
  }
});

module.exports = router;
