const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const { getPerkMachineStatus, spinPerkMachine, hatchEgg } = require('../services/perkMachineService');
const { activatePerkItem } = require('../services/perkBoostService');
const {
  adminResetFreeSpin,
  adminGrantSavvy,
  adminGrantEgg,
  adminClearHistory,
} = require('../services/perkMachineAdminService');
const { SPIN_MODES } = require('../config/perkMachineRewards');

const router = express.Router();

router.get('/status', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    res.json(getPerkMachineStatus(user));
  } catch (err) {
    console.error('[perk-machine/status]', err);
    next(err);
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

router.post('/spin', auth, async (req, res, next) => {
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
    if (err.status) {
      return res.status(err.status).json({
        message: err.message,
        code: err.code,
        required: err.required,
        balance: err.balance,
      });
    }
    console.error('[perk-machine/spin]', err);
    next(err);
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

    const itemKey = String(req.body?.itemKey || '').trim();
    const result = activatePerkItem(user, itemKey);
    await user.save();

    const { user: _omit, ...rest } = result;
    res.json({
      ...rest,
      message: result.boost
        ? `${result.item.label} activated.`
        : `${result.item.label} activated.`,
      status: getPerkMachineStatus(user),
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[perk-machine/activate]', err);
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

module.exports = router;
