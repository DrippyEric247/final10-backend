const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const {
  buildStatus,
  registerDealAction,
  claimMilestone,
  adminSetStreak,
  adminResetScoutSupport,
  ScoutSupportError,
  DEAL_ACTION_TYPES,
} = require('../services/scoutSupportService');
const { logLiveEventAdmin } = require('../services/liveEventsAdminService');

const router = express.Router();

router.get('/status', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    res.json(buildStatus(user));
  } catch (err) {
    console.error('[scout-support/status]', err);
    next(err);
  }
});

router.post('/register-action', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const actionType = String(req.body?.actionType || '').trim();
    const meta = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {};

    const result = await registerDealAction(user, actionType, meta);
    res.json(result);
  } catch (err) {
    if (err instanceof ScoutSupportError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-support/register-action]', err);
    next(err);
  }
});

router.post('/claim/:milestone', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const milestone = Number(req.params.milestone);
    const result = await claimMilestone(user, milestone);
    res.json({
      message: `Scout Support called in — ${result.label}`,
      ...result,
    });
  } catch (err) {
    if (err instanceof ScoutSupportError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-support/claim]', err);
    next(err);
  }
});

router.get('/admin/ping', auth, requireAdminAccess(), (req, res) => {
  res.json({ ok: true, feature: 'scout-support' });
});

router.post('/admin/add-deal', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const adminUser = user;
    const actionType = String(req.body?.actionType || 'deal_secured_test').trim();
    const result = await registerDealAction(user, actionType, { admin: true });
    const log = logLiveEventAdmin('scout_add_deal', adminUser, { actionType });
    res.json({ ...result, adminLog: log });
  } catch (err) {
    if (err instanceof ScoutSupportError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-support/admin/add-deal]', err);
    next(err);
  }
});

router.post('/admin/set-streak', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const adminUser = user;
    const count = Number(req.body?.count);
    const status = await adminSetStreak(user, count);
    const log = logLiveEventAdmin('scout_set_streak', adminUser, { count });
    res.json({ status, adminLog: log });
  } catch (err) {
    console.error('[scout-support/admin/set-streak]', err);
    next(err);
  }
});

router.post('/admin/reset', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const adminUser = user;
    const status = await adminResetScoutSupport(user);
    const log = logLiveEventAdmin('scout_reset', adminUser, {});
    res.json({ status, adminLog: log });
  } catch (err) {
    console.error('[scout-support/admin/reset]', err);
    next(err);
  }
});

router.post('/admin/force-claim', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const adminUser = user;
    const milestone = Number(req.body?.milestone);
    const result = await claimMilestone(user, milestone);
    const log = logLiveEventAdmin('scout_force_claim', adminUser, { milestone });
    res.json({ ...result, adminLog: log });
  } catch (err) {
    if (err instanceof ScoutSupportError) {
      return res.status(err.status).json({ message: err.message, code: err.code });
    }
    console.error('[scout-support/admin/force-claim]', err);
    next(err);
  }
});

router.get('/action-types', auth, (req, res) => {
  res.json({ actionTypes: DEAL_ACTION_TYPES });
});

module.exports = router;
