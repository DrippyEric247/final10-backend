const Joi = require('joi');

const auctionScanned = Joi.object({
  auctionId: Joi.string().trim().max(80).allow(''),
  itemId: Joi.string().trim().max(80).allow(''),
  secondsRemaining: Joi.number().min(0).max(86400).required(),
  marketplace: Joi.string().trim().max(40).required(),
  category: Joi.string().trim().max(80).allow('', null).optional(),
}).custom((v, helpers) => {
  const aid = String(v.auctionId || v.itemId || '').trim();
  if (!aid) {
    return helpers.error('any.invalid');
  }
  const { itemId: _drop, auctionId: _a, ...rest } = v;
  return { ...rest, auctionId: aid };
}).messages({ 'any.invalid': 'auctionId or itemId is required' });

const bidPlaced = Joi.object({
  auctionId: Joi.string().trim().min(1).max(80).required(),
  bidAmount: Joi.number().min(0).max(1e10).required(),
  secondsRemaining: Joi.number().min(0).max(86400).required(),
  marketplace: Joi.string().trim().max(40).required(),
  progressionTrustToken: Joi.string().trim().min(16).max(128).optional(),
});

const auctionWon = Joi.object({
  auctionId: Joi.string().trim().min(1).max(80).required(),
  winAmount: Joi.number().min(0).max(1e10).required(),
  secondsRemaining: Joi.number().min(0).max(86400).required(),
  marketplace: Joi.string().trim().max(40).required(),
  progressionTrustToken: Joi.string().trim().min(16).max(128).optional(),
});

const dailyLogin = Joi.object({
  streakDay: Joi.number().integer().min(1).max(10000).required(),
  rewardClaimed: Joi.boolean().required(),
});

const powerBoost = Joi.object({
  source: Joi.string().trim().min(1).max(120).required(),
  multiplierDelta: Joi.number().min(-1).max(1).optional(),
});

const savvyPoints = Joi.object({
  amount: Joi.number().min(0).max(1e8).required(),
  source: Joi.string().trim().min(1).max(120).required(),
});

const rankChanged = Joi.object({
  previousRank: Joi.number().integer().min(1).max(5_000_000).required(),
  newRank: Joi.number().integer().min(1).max(5_000_000).required(),
});

const powerMult = Joi.object({
  previousMultiplier: Joi.number().min(0.01).max(100).required(),
  newMultiplier: Joi.number().min(0.01).max(100).required(),
});

const buyNowScanned = Joi.object({
  itemId: Joi.string().trim().min(1).max(80).required(),
  marketplace: Joi.string().trim().max(40).required(),
  listingMode: Joi.string().valid('buy_now', 'mixed', 'auction').optional(),
  category: Joi.string().trim().max(80).allow('', null).optional(),
});

const recommendedDeal = Joi.object({
  itemId: Joi.string().trim().min(1).max(80).required(),
  marketplace: Joi.string().trim().max(40).required(),
  recommendationType: Joi.string().max(40).optional(),
  confidenceScore: Joi.number().min(0).max(1).optional(),
});

const STREAK = Joi.object({
  streakType: Joi.string().trim().max(40).required(),
  days: Joi.number().min(0).max(10_000).required(),
});

const SCHEMAS = {
  auction_scanned: auctionScanned,
  bid_placed: bidPlaced,
  auction_won: auctionWon,
  daily_login_claimed: dailyLogin,
  power_boost_claimed: powerBoost,
  savvy_points_earned: savvyPoints,
  rank_changed: rankChanged,
  power_multiplier_changed: powerMult,
  buy_now_scanned: buyNowScanned,
  recommended_deal_viewed: recommendedDeal,
  streak_updated: STREAK,
};

/**
 * @returns {{ ok: true, payload: object } | { ok: false, code: string, message: string }}
 */
function validateStrictEventPayload(type, payload) {
  const schema = SCHEMAS[type];
  if (!schema) {
    return { ok: false, code: 'UNSUPPORTED_EVENT_TYPE', message: 'Event type is not accepted from this endpoint' };
  }
  const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    return {
      ok: false,
      code: 'INVALID_EVENT_PAYLOAD',
      message: error.details.map((d) => d.message.replace(/"/g, '')).join('; '),
    };
  }
  return { ok: true, payload: value };
}

module.exports = { validateStrictEventPayload, SCHEMAS };
