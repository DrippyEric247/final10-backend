const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { requireAdminAccess } = require('../middleware/requireRole');
const { HttpError } = require('../middleware/apiErrors');
const {
  getEggExchangeStatus,
  performEggExchange,
  EggExchangeError,
} = require('../services/eggExchangeService');
const {
  adminGrantEggsForExchange,
  adminGrantSavvyForExchange,
  adminResetExchangeInventory,
  adminPresetRareToEpic,
  adminPresetEpicToLegendary,
  adminPresetLegendaryToMythic,
} = require('../services/eggExchangeAdminService');
const { EXCHANGE_TYPES } = require('../config/eggExchangeConfig');

const router = express.Router();

function mapExchangeError(err, next) {
  if (err instanceof EggExchangeError) {
    return {
      status: err.status,
      body: {
        message: err.message,
        code: err.code,
        missingEggs: err.missingEggs,
        missingSavvy: err.missingSavvy,
        eggsOwned: err.eggsOwned,
        eggsRequired: err.eggsRequired,
        savvyBalance: err.savvyBalance,
        savvyRequired: err.savvyRequired,
      },
    };
  }
  return null;
}

router.get('/exchange/status', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));
    res.json(getEggExchangeStatus(user));
  } catch (err) {
    console.error('[eggs/exchange/status]', err);
    next(err);
  }
});

router.post('/exchange', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError(404, 'NOT_FOUND', 'User not found'));

    const exchangeType = String(req.body?.exchangeType || '').trim();
    if (!EXCHANGE_TYPES.includes(exchangeType)) {
      return next(new HttpError(400, 'INVALID_EXCHANGE_TYPE', 'exchangeType is invalid'));
    }

    const result = await performEggExchange(user, exchangeType);
    res.json(result);
  } catch (err) {
    const mapped = mapExchangeError(err);
    if (mapped) return res.status(mapped.status).json(mapped.body);
    console.error('[eggs/exchange]', err);
    next(err);
  }
});

router.get('/exchange/admin/ping', auth, requireAdminAccess(), (req, res) => {
  res.json({ ok: true, feature: 'egg-exchange' });
});

router.post('/exchange/admin/grant-rare', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await adminGrantEggsForExchange(user, 'rare', 25, user);
    res.json({ message: 'Granted 25 Rare eggs.', ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/grant-rare]', err);
    next(err);
  }
});

router.post('/exchange/admin/grant-epic', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await adminGrantEggsForExchange(user, 'epic', 25, user);
    res.json({ message: 'Granted 25 Epic eggs.', ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/grant-epic]', err);
    next(err);
  }
});

router.post('/exchange/admin/grant-legendary', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await adminGrantEggsForExchange(user, 'legendary', 10, user);
    res.json({ message: 'Granted 10 Legendary eggs.', ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/grant-legendary]', err);
    next(err);
  }
});

router.post('/exchange/admin/grant-savvy', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const amount = Number(req.body?.amount) || 20000;
    const result = await adminGrantSavvyForExchange(user, amount, user);
    res.json({ message: `Granted ${amount} Savvy.`, ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/grant-savvy]', err);
    next(err);
  }
});

router.post('/exchange/admin/reset', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await adminResetExchangeInventory(user, user);
    res.json({ message: 'Egg exchange inventory reset.', ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/reset]', err);
    next(err);
  }
});

router.post('/exchange/admin/preset-rare-epic', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await adminPresetRareToEpic(user, user);
    res.json({ message: 'Preset for Rare → Epic test.', ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/preset-rare-epic]', err);
    next(err);
  }
});

router.post('/exchange/admin/preset-epic-legendary', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await adminPresetEpicToLegendary(user, user);
    res.json({ message: 'Preset for Epic → Legendary test.', ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/preset-epic-legendary]', err);
    next(err);
  }
});

router.post('/exchange/admin/preset-legendary-mythic', auth, requireAdminAccess(), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const result = await adminPresetLegendaryToMythic(user, user);
    res.json({ message: 'Preset for Legendary → Mythic test.', ...result });
  } catch (err) {
    console.error('[eggs/exchange/admin/preset-legendary-mythic]', err);
    next(err);
  }
});

module.exports = router;
