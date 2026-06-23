const express = require('express');
const auth = require('../middleware/auth');
const { requireOwnerAccess } = require('../middleware/requireRole');
const {
  getCosmeticsForUser,
  equipCosmetic,
  grantCosmeticUnlock,
  revokeCosmeticUnlock,
  inspectCosmeticUnlockState,
} = require('../services/cosmeticInventoryService');
const { validateRequest } = require('../middleware/validateRequest');
const schemas = require('../validation/schemas');
const { HttpError } = require('../middleware/apiErrors');

const router = express.Router();

router.get('/me', auth, async (req, res, next) => {
  try {
    const data = await getCosmeticsForUser(req.user._id);
    return res.json(data);
  } catch (err) {
    if (err.status === 404) {
      return next(new HttpError(404, err.code || 'NOT_FOUND', err.message || 'Not found'));
    }
    return next(err);
  }
});

router.post('/equip', auth, validateRequest(schemas.cosmeticsEquipBody), async (req, res, next) => {
  try {
    const { type, itemId } = req.body;
    console.info('[cosmetics/equip] request', {
      userId: String(req.user._id),
      cosmeticId: itemId,
      cosmeticType: type,
    });
    const data = await equipCosmetic(req.user._id, type, itemId, { req });
    return res.json(data);
  } catch (err) {
    if (err.status === 400 || err.status === 403 || err.status === 404) {
      return next(new HttpError(err.status, err.code || 'BAD_REQUEST', err.message || 'Request failed'));
    }
    return next(err);
  }
});

router.get('/admin/inspect', auth, requireOwnerAccess(), async (req, res, next) => {
  try {
    const userKey = String(req.query.userKey || '').trim();
    if (!userKey) {
      return next(new HttpError(400, 'MISSING_USER', 'userKey query param is required'));
    }
    const data = await inspectCosmeticUnlockState(userKey);
    console.info('[cosmetics/admin/inspect]', data);
    return res.json(data);
  } catch (err) {
    if (err.status === 400 || err.status === 404) {
      return next(new HttpError(err.status, err.code || 'BAD_REQUEST', err.message || 'Request failed'));
    }
    return next(err);
  }
});

router.post(
  '/admin/grant',
  auth,
  requireOwnerAccess(),
  validateRequest(schemas.cosmeticsAdminGrantBody),
  async (req, res, next) => {
    try {
      const { userKey, itemId, note } = req.body;
      const data = await grantCosmeticUnlock(req.user._id, userKey, itemId, note);
      return res.json(data);
    } catch (err) {
      if (err.status === 400 || err.status === 404) {
        return next(new HttpError(err.status, err.code || 'BAD_REQUEST', err.message || 'Request failed'));
      }
      return next(err);
    }
  }
);

router.post(
  '/admin/revoke',
  auth,
  requireOwnerAccess(),
  validateRequest(schemas.cosmeticsAdminRevokeBody),
  async (req, res, next) => {
    try {
      const { userKey, itemId } = req.body;
      const data = await revokeCosmeticUnlock(req.user._id, userKey, itemId);
      return res.json(data);
    } catch (err) {
      if (err.status === 400 || err.status === 404) {
        return next(new HttpError(err.status, err.code || 'BAD_REQUEST', err.message || 'Request failed'));
      }
      return next(err);
    }
  }
);

module.exports = router;
