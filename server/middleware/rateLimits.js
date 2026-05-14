const rateLimit = require('express-rate-limit');

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT', message: 'Too many login attempts. Try again later.' },
  skipSuccessfulRequests: true,
});

const authSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT', message: 'Too many signup attempts from this IP.' },
});

const progressionEventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT', message: 'Too many progression events. Slow down.' },
});

const ebaySearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT',
    message:
      'Too many marketplace searches right now. Please wait about a minute, then try again.',
  },
});

const ebayBidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT',
    message: 'Too many bid attempts from your session. Pause briefly and retry.',
  },
});

/** Browse-backed seller trends runs several internal searches — keep separate from product search. */
const ebaySellerTrendsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT',
    message: 'Seller trend refresh limit reached. Try again in a minute.',
  },
});

/** True Market Value comp lookups — heavier than search, so bucketed separately. */
const marketValueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT', message: 'Too many market value lookups.' },
});

/** Reserved for POST /api/auth/password-reset when implemented */
const authPasswordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT', message: 'Too many password reset attempts.' },
});

module.exports = {
  authLoginLimiter,
  authSignupLimiter,
  authPasswordResetLimiter,
  progressionEventsLimiter,
  ebaySearchLimiter,
  ebayBidLimiter,
  ebaySellerTrendsLimiter,
  marketValueLimiter,
};
