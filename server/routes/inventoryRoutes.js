const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { HttpError } = require('../middleware/apiErrors');
const { useInventoryToken } = require('../services/inventoryActivationService');
const { getPerkMachineStatusWithEvents } = require('../services/perkMachineService');

const router = express.Router();

/**
 * POST /api/inventory/use
 * Body: { itemType, idempotencyKey }
 */
router.post('/use', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const result = await useInventoryToken(user, {
      itemType: req.body?.itemType,
      itemKey: req.body?.itemKey,
      idempotencyKey: req.body?.idempotencyKey,
    });
    await user.save();

    const status = await getPerkMachineStatusWithEvents(user);
    res.json({
      ...result,
      status,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        consumed: false,
        message: err.message,
        code: err.code,
      });
    }
    console.error('[inventory/use]', err);
    next(err);
  }
});

/** GET /api/inventory/status — active boosts + token counts */
router.get('/status', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const status = await getPerkMachineStatusWithEvents(user);
    res.json({
      activeBoosts: status.activeBoosts || [],
      tokens: status.tokens || {},
      eggInventory: status.eggInventory || {},
      extraFreeSpins: status.extraFreeSpins || 0,
    });
  } catch (err) {
    console.error('[inventory/status]', err);
    next(err);
  }
});

module.exports = router;
