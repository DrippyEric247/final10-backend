const express = require('express');
const auth = require('../middleware/auth');
const { getCosmeticsForUser, equipCosmetic } = require('../services/cosmeticInventoryService');
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
    const data = await equipCosmetic(req.user._id, type, itemId, { req });
    return res.json(data);
  } catch (err) {
    if (err.status === 400 || err.status === 403 || err.status === 404) {
      return next(new HttpError(err.status, err.code || 'BAD_REQUEST', err.message || 'Request failed'));
    }
    return next(err);
  }
});

module.exports = router;
