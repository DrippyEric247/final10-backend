const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const { perkMachineSpinLimiter } = require('../middleware/rateLimits');
const {
  getPerkMachineStatus,
  getPerkMachineStatusWithEvents,
  spinPerkMachine,
  hatchEgg,
  useBattlePassTierSkip,
} = require('../services/perkMachineService');
const { activatePerkItem, activatePersonalEventToken } = require('../services/perkBoostService');
const { activateMaxSupplyDrop } = require('../services/supplyDropService');
const {
  adminResetFreeSpin,
  adminGrantSavvy,
  adminGrantEgg,
  adminClearHistory,
  adminSetNukeSpinProgress,
  adminTriggerNukeEvent,
  adminEndNukeEvent,
  adminGetNukeState,
  adminGetNukeStateForUserId,
} = require('../services/perkMachineAdminService');
const {
  runPaidSpinRegression,
  runDisposablePaidSpinProbe,
  runRewardFamilyMatrix,
  runDisposableRewardFamilyMatrix,
  compareFreeVsPaidPools,
  compareFreeVsPaidExecutionPaths,
  auditSessionPropagation,
  TEST_SAVVY_1,
} = require('../services/perkMachineRegressionService');
const { listRegressionRewardFamilies } = require('../config/perkMachineTestRewards');
const { SPIN_MODES, getRewardIndex } = require('../config/perkMachineRewards');

const router = express.Router();

router.get('/status', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    res.json(await getPerkMachineStatusWithEvents(user));
  } catch (err) {
    console.error('[perk-machine/status]', err);
    if (res.headersSent) return next(err);
    return res.status(500).json({
      code: 'STATUS_FAILED',
      message: 'Perk Machine status unavailable. Try again shortly.',
      ...(process.env.NODE_ENV !== 'production' && err?.message ? { detail: err.message } : {}),
    });
  }
});

router.get('/history', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const status = getPerkMachineStatus(user);
    res.json({ history: status.recentSpins });
  } catch (err) {
    console.error('[perk-machine/history]', err);
    next(err);
  }
});

router.get('/reward-index', auth, async (req, res, next) => {
  try {
    res.json({ entries: getRewardIndex() });
  } catch (err) {
    console.error('[perk-machine/reward-index]', err);
    next(err);
  }
});

router.post('/spin', auth, perkMachineSpinLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const mode = String(req.body?.mode || '').trim();
    const result = await spinPerkMachine(user, { mode });
    res.json({
      message: result.resultMessage,
      ...result,
    });
  } catch (err) {
    console.error('[perk-machine/spin]', err);
    if (err.status) {
      const clientMessage =
        err.code === 'INSUFFICIENT_SAVVY'
          ? err.message
          : err.code === 'SPIN_IN_PROGRESS' || err.code === 'SPIN_COOLDOWN'
            ? err.message
            : err.code === 'FREE_SPIN_UNAVAILABLE'
              ? err.message
              : err.status >= 500
                ? 'Spin failed — no Savvy was spent. Try again.'
                : err.message;
      return res.status(err.status).json({
        message: clientMessage,
        code: err.code,
        required: err.required,
        balance: err.balance,
        ...(process.env.NODE_ENV !== 'production' && err?.message ? { detail: err.message } : {}),
      });
    }
    return res.status(500).json({
      code: 'SPIN_FAILED',
      message: 'Spin failed — no Savvy was spent. Try again.',
      ...(process.env.NODE_ENV !== 'production' && err?.message ? { detail: err.message } : {}),
    });
  }
});

router.post('/hatch', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const eggTier = String(req.body?.eggTier || '').trim();
    const result = await hatchEgg(user, { eggTier });
    res.json({
      message: result.resultMessage,
      ...result,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        message: err.message,
        code: err.code,
      });
    }
    console.error('[perk-machine/hatch]', err);
    next(err);
  }
});

router.post('/activate', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const itemKey = String(req.body?.itemKey || req.body?.itemType || '').trim();
    const idempotencyKey = String(req.body?.idempotencyKey || '').trim();

    if (idempotencyKey) {
      const { useInventoryToken } = require('../services/inventoryActivationService');
      const result = await useInventoryToken(user, { itemType: itemKey, idempotencyKey });
      await user.save();
      const status = await getPerkMachineStatusWithEvents(user);
      return res.json({ ...result, status });
    }

    const result = activatePerkItem(user, itemKey);
    await user.save();

    const { user: _omit, ...rest } = result;
    res.json({
      ...rest,
      success: true,
      consumed: true,
      message: result.boost?.extended
        ? `${result.item.label} extended.`
        : result.freeSpins
          ? 'Free spin added.'
          : `${result.item.label} activated.`,
      status: getPerkMachineStatus(user),
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
    console.error('[perk-machine/activate]', err);
    next(err);
  }
});

/** Activate a personal timed-event token (Double XP / Savvy Sale) by id. */
router.post('/activate-event', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const tokenId = String(req.body?.tokenId || '').trim();
    const result = activatePersonalEventToken(user, tokenId);
    await user.save();

    res.json({
      activated: true,
      item: result.item,
      event: result.event,
      message: `${result.item.label} activated.`,
      status: getPerkMachineStatus(user),
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, code: err.code });
    console.error('[perk-machine/activate-event]', err);
    next(err);
  }
});

/** Spend a Max Supply Drop token to spawn a claimable drop (double if flagged). */
router.post('/max-supply-drop', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const result = await activateMaxSupplyDrop(user);
    res.json({
      activated: true,
      drop: result.drop,
      doubleValue: result.doubleValue,
      message: result.doubleValue
        ? 'Max Supply Drop deployed — double value!'
        : 'Max Supply Drop deployed.',
      savvyBalance: result.savvyBalance,
      status: result.perkMachine,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, code: err.code });
    console.error('[perk-machine/max-supply-drop]', err);
    next(err);
  }
});

/** Spend a Battle Pass Tier Skip token to advance one tier. */
router.post('/tier-skip', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const result = await useBattlePassTierSkip(user);
    res.json({
      skipped: true,
      fromTier: result.fromTier,
      toTier: result.toTier,
      xpGranted: result.xpGranted,
      message: `Skipped to Battle Pass tier ${result.toTier}.`,
      savvyBalance: result.savvyBalance,
      status: result.status,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, code: err.code });
    console.error('[perk-machine/tier-skip]', err);
    next(err);
  }
});

/** Admin-only QA controls */
router.get('/admin/ping', auth, requireAdminAccess(), (req, res) => {
  res.json({ ok: true, admin: true });
});

router.post('/admin/reset-free-spin', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const result = await adminResetFreeSpin(user, req.adminUser || user);
    res.json({ message: 'Free spin timer reset.', ...result });
  } catch (err) {
    console.error('[perk-machine/admin/reset-free-spin]', err);
    next(err);
  }
});

router.post('/admin/grant-savvy', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const amount = Number(req.body?.amount) || 500;
    const result = await adminGrantSavvy(user, amount, req.adminUser || user);
    res.json({ message: `Granted ${amount} Savvy.`, ...result });
  } catch (err) {
    console.error('[perk-machine/admin/grant-savvy]', err);
    next(err);
  }
});

router.post('/admin/grant-egg', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const tier = String(req.body?.tier || 'rare');
    const count = Number(req.body?.count) || 1;
    const result = await adminGrantEgg(user, tier, count, req.adminUser || user);
    res.json({ message: `Granted ${count} ${tier} egg(s).`, ...result });
  } catch (err) {
    console.error('[perk-machine/admin/grant-egg]', err);
    next(err);
  }
});

/** Full paid transaction regression — disposable test account by default (no admin balance impact). */
router.post('/admin/paid-spin-regression', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const forceRewardId = String(req.body?.forceReward || req.body?.forceRewardId || TEST_SAVVY_1.id).trim();
    const mode = String(req.body?.mode || SPIN_MODES.PAID_1).trim();
    const useDisposable = req.body?.useDisposableAccount !== false;
    const gitCommitSha =
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.RAILWAY_GIT_SHA ||
      process.env.GIT_COMMIT ||
      null;

    const result = useDisposable
      ? await runDisposablePaidSpinProbe({ mode, forceRewardId })
      : await runPaidSpinRegression(await User.findById(req.user.id), { mode, forceRewardId });

    res.json({
      message: `Paid spin regression ${result.outcome} (${forceRewardId}).`,
      gitCommitSha,
      executionPathComparison: compareFreeVsPaidExecutionPaths(),
      ...result,
    });
  } catch (err) {
    console.error('[perk-machine/admin/paid-spin-regression]', err);
    next(err);
  }
});

/** Phase 4 matrix — disposable test account by default. */
router.post('/admin/paid-spin-regression/matrix', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const mode = String(req.body?.mode || SPIN_MODES.PAID_1).trim();
    const useDisposable = req.body?.useDisposableAccount !== false;
    const gitCommitSha =
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      process.env.RAILWAY_GIT_SHA ||
      process.env.GIT_COMMIT ||
      null;

    const matrix = useDisposable
      ? await runDisposableRewardFamilyMatrix({ mode })
      : await runRewardFamilyMatrix(await User.findById(req.user.id), { mode });

    res.json({
      message: 'Paid spin regression matrix complete.',
      gitCommitSha,
      poolComparison: compareFreeVsPaidPools(),
      sessionAudit: auditSessionPropagation(),
      executionPathComparison: compareFreeVsPaidExecutionPaths(),
      families: listRegressionRewardFamilies(),
      ...matrix,
    });
  } catch (err) {
    console.error('[perk-machine/admin/paid-spin-regression/matrix]', err);
    next(err);
  }
});

router.post('/admin/force-spin', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const slots = Number(req.body?.slots) === 3 ? SPIN_MODES.PAID_3 : SPIN_MODES.PAID_1;
    const pm = user.perkMachine || {};
    pm.lastSpinAt = null;
    user.perkMachine = pm;
    user.markModified('perkMachine');
    await user.save();

    const result = await spinPerkMachine(user, {
      mode: slots,
      adminBypassCost: true,
    });
    res.json({ message: `Force ${slots === SPIN_MODES.PAID_3 ? 3 : 1}-slot spin complete.`, ...result });
  } catch (err) {
    console.error('[perk-machine/admin/force-spin]', err);
    next(err);
  }
});

router.post('/admin/force-legendary', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const pm = user.perkMachine || {};
    pm.lastSpinAt = null;
    user.perkMachine = pm;
    user.markModified('perkMachine');
    await user.save();

    const result = await spinPerkMachine(user, {
      mode: SPIN_MODES.PAID_1,
      forceRewardId: 'egg_legendary',
      adminBypassCost: true,
    });
    res.json({ message: 'Legendary Egg forced.', ...result });
  } catch (err) {
    console.error('[perk-machine/admin/force-legendary]', err);
    next(err);
  }
});

router.post('/admin/clear-history', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const result = await adminClearHistory(user, req.adminUser || user);
    res.json({ message: 'Spin history cleared.', ...result });
  } catch (err) {
    console.error('[perk-machine/admin/clear-history]', err);
    next(err);
  }
});

router.get('/admin/nuke-state', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const result = await adminGetNukeState(user);
    res.json(result);
  } catch (err) {
    console.error('[perk-machine/admin/nuke-state]', err);
    next(err);
  }
});

router.get('/admin/nuke/user/:userId', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const result = await adminGetNukeStateForUserId(req.params.userId);
    res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return next(new HttpError(404, 'NOT_FOUND', err.message));
    }
    console.error('[perk-machine/admin/nuke/user]', err);
    next(err);
  }
});

router.post('/admin/nuke/set-progress', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const count = Number(req.body?.count);
    const result = await adminSetNukeSpinProgress(user, count, req.adminUser || user);
    res.json({ message: `Nuke progress set to ${Math.round(count)}.`, ...result });
  } catch (err) {
    console.error('[perk-machine/admin/nuke/set-progress]', err);
    next(err);
  }
});

router.post('/admin/nuke/trigger', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const result = await adminTriggerNukeEvent(
      user,
      {
        multiplier: req.body?.multiplier,
        durationMinutes: req.body?.durationMinutes,
      },
      req.adminUser || user
    );
    res.json({ message: 'Nuke event triggered.', ...result });
  } catch (err) {
    console.error('[perk-machine/admin/nuke/trigger]', err);
    next(err);
  }
});

router.post('/admin/nuke/end', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    const result = await adminEndNukeEvent(user, req.adminUser || user);
    res.json({ message: 'Nuke event ended.', ...result });
  } catch (err) {
    console.error('[perk-machine/admin/nuke/end]', err);
    next(err);
  }
});

module.exports = router;
