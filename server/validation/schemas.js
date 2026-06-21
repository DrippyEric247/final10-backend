const Joi = require('joi');

/** Client-submitted events only — `task_completed` is server-emitted during engine cascade, never accepted from HTTP. */
const BATTLE_PASS_EVENT_TYPES = [
  'daily_login_claimed',
  'power_boost_claimed',
  'auction_scanned',
  'bid_placed',
  'auction_won',
  'savvy_points_earned',
  'streak_updated',
  'rank_changed',
  'power_multiplier_changed',
  'buy_now_scanned',
  'recommended_deal_viewed',
];

const progressionEventPayload = Joi.object({
  id: Joi.string().trim().min(12).max(128).required(),
  type: Joi.string()
    .valid(...BATTLE_PASS_EVENT_TYPES)
    .required(),
  userId: Joi.string().trim().max(128).optional(),
  timestamp: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  payload: Joi.object().unknown(true).required(),
}).unknown(false);

exports.progressionEventsBody = Joi.object({
  event: progressionEventPayload.required(),
  seasonId: Joi.string().trim().max(64).optional(),
});

exports.progressionInitBody = Joi.object({
  reset: Joi.boolean().optional(),
});

exports.progressionPremiumBody = Joi.object({
  unlocked: Joi.boolean().optional(),
}).unknown(false);

exports.paymentCheckoutBody = Joi.object({
  successUrl: Joi.string().uri().max(2048).optional(),
  cancelUrl: Joi.string().uri().max(2048).optional(),
}).unknown(false);

exports.cosmeticsEquipBody = Joi.object({
  type: Joi.string().valid('emblem', 'calling_card', 'title').required(),
  itemId: Joi.string().trim().min(1).max(128).required(),
});

// Phase B: creator/referral attribution payload captured client-side and
// forwarded on signup. Loose by design — never block signup on attribution.
const attributionPayload = Joi.object({
  creatorHandle: Joi.string().trim().max(80).allow('', null).optional(),
  creatorCode: Joi.string().trim().max(64).allow('', null).optional(),
  referralCode: Joi.string().trim().max(64).allow('', null).optional(),
  campaign: Joi.string().trim().max(120).allow('', null).optional(),
  source: Joi.string().trim().max(40).allow('', null).optional(),
  capturedAt: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  landingPath: Joi.string().trim().max(512).allow('', null).optional(),
}).unknown(true);

exports.authSignupBody = Joi.object({
  firstName: Joi.string().trim().min(1).max(80).required(),
  lastName: Joi.string().trim().min(1).max(80).required(),
  username: Joi.string().trim().min(2).max(40).pattern(/^[a-zA-Z0-9_-]+$/).required(),
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string().min(10).max(128).required(),
  referralCode: Joi.string().trim().max(64).allow('', null).optional(),
  attribution: attributionPayload.optional(),
});

exports.authLoginBody = Joi.object({
  email: Joi.string().trim().email().max(254).required(),
  password: Joi.string().min(1).max(128).required(),
});

exports.ebaySearchQuery = Joi.object({
  q: Joi.string().allow('').max(200).optional(),
  keywords: Joi.string().allow('').max(200).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(30), Joi.string().pattern(/^\d+$/)).optional(),
  offset: Joi.alternatives().try(Joi.number().integer().min(0).max(50000), Joi.string().pattern(/^\d+$/)).optional(),
  page: Joi.alternatives().try(Joi.number().integer().min(1).max(5000), Joi.string().pattern(/^\d+$/)).optional(),
  categoryId: Joi.string().max(120).allow('').optional(),
  sortOrder: Joi.string().max(80).allow('').optional(),
  sort: Joi.string().max(80).allow('').optional(),
  minPrice: Joi.alternatives().try(Joi.number(), Joi.string().max(32)).optional(),
  maxPrice: Joi.alternatives().try(Joi.number(), Joi.string().max(32)).optional(),
  conditionIds: Joi.string().max(200).allow('').optional(),
  listingMode: Joi.string().valid('auction', 'buy_now', 'mixed').optional(),
  endingSoonOnly: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
}).unknown(true);

exports.ebayFinal10Query = Joi.object({
  q: Joi.string().allow('').max(200).optional(),
  keywords: Joi.string().allow('').max(200).optional(),
  limit: Joi.alternatives().try(Joi.number().integer().min(1).max(30), Joi.string().pattern(/^\d+$/)).optional(),
  offset: Joi.alternatives().try(Joi.number().integer().min(0).max(50000), Joi.string().pattern(/^\d+$/)).optional(),
  categoryId: Joi.string().max(120).allow('').optional(),
  minPrice: Joi.alternatives().try(Joi.number(), Joi.string().max(32)).optional(),
  maxPrice: Joi.alternatives().try(Joi.number(), Joi.string().max(32)).optional(),
}).unknown(true);

exports.ebayBidPlaceBody = Joi.object({
  itemId: Joi.alternatives().try(Joi.string().trim().max(64), Joi.number().integer().positive()).required(),
  maxAmount: Joi.alternatives().try(Joi.number().positive().max(1e9), Joi.string().pattern(/^\d+(\.\d+)?$/)).required(),
  currency: Joi.string().trim().length(3).uppercase().required(),
});

exports.ebaySellerTrendsQuery = Joi.object({
  /** IANA timezone for “best time to list” from listing end-time histogram */
  tz: Joi.string().trim().max(64).optional(),
}).unknown(false);
