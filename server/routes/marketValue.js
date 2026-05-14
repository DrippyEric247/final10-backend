/**
 * Final10 — public Market Value API.
 *
 * Surfaces the True Market Value engine to the client so any tab (Auctions,
 * Quick Snipes, Alerts, Build Wars, Savvy AI) can ask "what is this thing
 * actually worth?" without redoing the comp math on the wire.
 *
 * Single-item endpoint:
 *   GET  /api/market-value?q=ps5+slim&conditionIds=3000&categoryId=139973
 *
 * Batch endpoint (used by feeds rendering many cards at once):
 *   POST /api/market-value/batch  { items: [{ q, conditionIds, categoryId }] }
 */

const express = require('express');
const Joi = require('joi');
const auth = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { marketValueLimiter } = require('../middleware/rateLimits');
const { isProduction } = require('../config/envValidation');
const { getMarketValue } = require('../services/marketValueService');

const router = express.Router();

const EBAY_AUTH_BYPASS_ALLOWED =
  !isProduction() && process.env.DISABLE_EBAY_AUTH === 'true';

router.use((req, res, next) => {
  if (EBAY_AUTH_BYPASS_ALLOWED) return next();
  return auth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return next();
  });
});

const querySchema = Joi.object({
  q: Joi.string().trim().min(1).max(200).required(),
  conditionIds: Joi.string().max(200).allow('').optional(),
  categoryId: Joi.string().max(120).allow('').optional(),
  source: Joi.string().valid('auto', 'sold', 'active').optional(),
}).unknown(true);

const batchSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        q: Joi.string().trim().min(1).max(200).required(),
        conditionIds: Joi.string().max(200).allow('').optional(),
        categoryId: Joi.string().max(120).allow('').optional(),
        source: Joi.string().valid('auto', 'sold', 'active').optional(),
      }).unknown(false)
    )
    .min(1)
    .max(20)
    .required(),
});

router.get(
  '/',
  marketValueLimiter,
  validateRequest(querySchema, 'query'),
  async (req, res) => {
    try {
      const { q, conditionIds, categoryId, source } = req.query;
      const stats = await getMarketValue({
        q,
        conditionIds,
        categoryId,
        preferredSource: source || 'auto',
      });
      res.set('Cache-Control', 'private, max-age=60');
      res.json({ success: true, data: stats });
    } catch (err) {
      console.error('market-value error', err.message || err);
      res.status(500).json({ success: false, error: 'market_value_failed' });
    }
  }
);

router.post(
  '/batch',
  marketValueLimiter,
  validateRequest(batchSchema, 'body'),
  async (req, res) => {
    try {
      const { items } = req.body;
      const results = await Promise.all(
        items.map(async (entry) => {
          try {
            const stats = await getMarketValue({
              q: entry.q,
              conditionIds: entry.conditionIds,
              categoryId: entry.categoryId,
              preferredSource: entry.source || 'auto',
            });
            return { ok: true, q: entry.q, data: stats };
          } catch (err) {
            return { ok: false, q: entry.q, error: err.message || 'failed' };
          }
        })
      );
      res.json({ success: true, results });
    } catch (err) {
      console.error('market-value batch error', err.message || err);
      res.status(500).json({ success: false, error: 'market_value_batch_failed' });
    }
  }
);

module.exports = router;
