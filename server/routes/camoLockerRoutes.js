const express = require('express');
const auth = require('../middleware/auth');
const { requireOwnerAccess } = require('../middleware/requireRole');
const { validateRequest } = require('../middleware/validateRequest');
const { progressionEventsLimiter } = require('../middleware/rateLimits');
const { progressionBurstGuard } = require('../middleware/progressionBurstGuard');
const schemas = require('../validation/schemas');
const { HttpError } = require('../middleware/apiErrors');
const {
  getCamoLockerForUser,
  getNukeCollectionPreview,
  recordCamoCategoryProgress,
  grantCamoUnlock,
  claimCamoReward,
  markCamosSeen,
} = require('../services/camoLockerService');
const { getMasterClassifiedForUser, getMasterClassifiedAdminPreview } = require('../services/masterClassifiedService');
const User = require('../models/User');

const router = express.Router();

function forward(err, next) {
  if (err.status && err.status >= 400 && err.status < 500) {
    return next(new HttpError(err.status, err.code || 'BAD_REQUEST', err.message || 'Request failed'));
  }
  return next(err);
}

/** Universal locker state — every Savvy app calls this with the same token. */
router.get('/me', auth, async (req, res, next) => {
  try {
    return res.json(await getCamoLockerForUser(req.user._id));
  } catch (err) {
    return forward(err, next);
  }
});

/** Classified / Master Collection — server-authoritative camo mastery endgame. */
router.get('/master-classified/me', auth, async (req, res, next) => {
  try {
    return res.json(await getMasterClassifiedForUser(req.user._id));
  } catch (err) {
    return forward(err, next);
  }
});

/** Admin-only Classified Master asset preview — 404 for normal users. Read-only; no unlock side effects. */
router.get('/master-classified/admin-preview', auth, async (req, res, next) => {
  try {
    return res.json(await getMasterClassifiedAdminPreview(req.user._id));
  } catch (err) {
    if (err.status === 404) return next(new HttpError(404, 'NOT_FOUND', 'Not found'));
    return forward(err, next);
  }
});

/** Secret Nuke Collection preview — admin/founder only; 404 for everyone else. */
router.get('/nuke/preview', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'Not found'));
    return res.json(await getNukeCollectionPreview(user));
  } catch (err) {
    if (err.status === 404) return next(new HttpError(404, 'NOT_FOUND', 'Not found'));
    return forward(err, next);
  }
});

/**
 * Signal that a qualifying category action happened. The server owns the
 * increment size, the daily cap and any resulting unlocks.
 */
router.post(
  '/progress',
  auth,
  progressionEventsLimiter,
  progressionBurstGuard,
  validateRequest(schemas.camoProgressBody),
  async (req, res, next) => {
    try {
      const { category, increment } = req.body;
      return res.json(await recordCamoCategoryProgress(req.user._id, category, increment));
    } catch (err) {
      return forward(err, next);
    }
  }
);

router.post('/seen', auth, async (req, res, next) => {
  try {
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.slice(0, 200) : [];
    return res.json(await markCamosSeen(req.user._id, itemIds));
  } catch (err) {
    return forward(err, next);
  }
});

/** Records claim intent on an already-unlocked camo. No fulfilment logic yet. */
router.post('/claim', auth, validateRequest(schemas.camoItemBody), async (req, res, next) => {
  try {
    return res.json(await claimCamoReward(req.user._id, req.body.itemId));
  } catch (err) {
    return forward(err, next);
  }
});

router.post(
  '/admin/grant',
  auth,
  requireOwnerAccess(),
  validateRequest(schemas.camoAdminGrantBody),
  async (req, res, next) => {
    try {
      const { userKey, itemId } = req.body;
      const User = require('../models/User');
      const mongoose = require('mongoose');
      const key = String(userKey).trim();
      const target = mongoose.Types.ObjectId.isValid(key)
        ? await User.findById(key)
        : await User.findOne({ $or: [{ username: key }, { email: key.toLowerCase() }] });
      if (!target) return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));
      const granted = await grantCamoUnlock(target._id, itemId, 'admin_grant');
      return res.json({ granted, state: await getCamoLockerForUser(target._id) });
    } catch (err) {
      return forward(err, next);
    }
  }
);

module.exports = router;
