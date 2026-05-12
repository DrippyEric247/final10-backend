const express = require('express');
const auth = require('../middleware/auth');
const progressionService = require('../services/progressionService');
const { BATTLE_PASS_SEASON_ID } = require('../lib/battlePassConfig');
const { validateRequest } = require('../middleware/validateRequest');
const { progressionEventsLimiter } = require('../middleware/rateLimits');
const { progressionBurstGuard } = require('../middleware/progressionBurstGuard');
const schemas = require('../validation/schemas');
const { HttpError } = require('../middleware/apiErrors');

const router = express.Router();

router.get('/me', auth, async (req, res, next) => {
  try {
    const state = await progressionService.getUserProgressionState(req.user._id);
    if (!state) {
      return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));
    }
    return res.json(state);
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/events',
  auth,
  progressionEventsLimiter,
  progressionBurstGuard,
  validateRequest(schemas.progressionEventsBody),
  async (req, res, next) => {
    try {
      const { event, seasonId } = req.body;
      const sid = typeof seasonId === 'string' && seasonId.length ? seasonId : BATTLE_PASS_SEASON_ID;
      const out = await progressionService.processBattlePassActionEvent(req.user._id, sid, event, { req });
      if (out.idempotentReplay) {
        return res.status(200).json({ ...out.state, meta: { replayed: true } });
      }
      if (out.httpError) {
        return res.status(out.httpError.status).json({
          ...out.httpError.body,
          state: out.state,
        });
      }
      return res.json(out.state);
    } catch (err) {
      return next(err);
    }
  }
);

router.post('/init', auth, validateRequest(schemas.progressionInitBody), async (req, res, next) => {
  try {
    const reset = Boolean(req.body.reset);
    const state = await progressionService.initUserProgression(req.user._id, { reset });
    return res.json(state);
  } catch (err) {
    return next(err);
  }
});

router.post('/premium', auth, validateRequest(schemas.progressionPremiumBody), async (req, res, next) => {
  try {
    const state = await progressionService.syncBattlePassPremiumFromEntitlement(req.user._id, { req });
    return res.json(state);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
