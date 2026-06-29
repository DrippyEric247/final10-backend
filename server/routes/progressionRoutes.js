const express = require('express');
const auth = require('../middleware/auth');
const { requireAdminAccess } = require('../middleware/requireRole');
const progressionService = require('../services/progressionService');
const battlePassClaimService = require('../services/battlePassClaimService');
const User = require('../models/User');
const { claimOnboardingFirstMoveReward } = require('../services/onboardingRewardService');
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

/** POST /api/progression/onboarding-first-move — grant first Best Move Savvy (idempotent). */
router.post('/onboarding-first-move', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new HttpError(404, 'USER_NOT_FOUND', 'User not found'));
    }

    const result = await claimOnboardingFirstMoveReward(user);

    if (result.alreadyClaimed) {
      return res.status(409).json(result);
    }

    if (!result.granted) {
      return res.status(500).json({ ...result, message: result.message || 'Claim failed.' });
    }

    return res.json(result);
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

/** Manually claim a battle pass tier reward (free or premium track). */
router.post('/claim-tier', auth, async (req, res, next) => {
  try {
    const { level, track } = req.body || {};
    const out = await battlePassClaimService.claimTierReward(req.user._id, { level, track });
    return res.json(out);
  } catch (err) {
    if (err && err.status && err.code) {
      return res.status(err.status).json({ code: err.code, message: err.message });
    }
    return next(err);
  }
});

/* ----------------------------- Admin testing ----------------------------- */

router.get('/admin/ping', auth, requireAdminAccess(), (req, res) => {
  res.json({ ok: true, admin: true });
});

router.post('/admin/set-tier', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const state = await battlePassClaimService.adminSetTier(req.user._id, req.body?.level);
    return res.json({ ok: true, state });
  } catch (err) {
    return next(err);
  }
});

router.post('/admin/grant-xp', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const amount = req.body?.amount != null ? req.body.amount : 1000;
    const state = await battlePassClaimService.adminGrantXp(req.user._id, amount);
    return res.json({ ok: true, state });
  } catch (err) {
    return next(err);
  }
});

router.post('/admin/reset-claims', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const state = await battlePassClaimService.adminResetClaims(req.user._id);
    return res.json({ ok: true, state });
  } catch (err) {
    return next(err);
  }
});

router.post('/admin/force-claim', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const out = await battlePassClaimService.adminForceClaimTier(req.user._id, req.body?.level);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
