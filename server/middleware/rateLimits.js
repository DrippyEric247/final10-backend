const rateLimit = require('express-rate-limit');
const { rateLimitSkipDev } = require('../lib/rateLimitDevBypass');

/** True for GET /api/auth/me (profile hydrate — not a credential guess). */
function isAuthMeRequest(req) {
  const path = String(req.originalUrl || req.url || req.path || '').split('?')[0];
  return req.method === 'GET' && /\/auth\/me(?:\/)?$/i.test(path);
}

/** Lenient limiter for session hydration — separate bucket from login brute-force. */
const authMeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: {
    code: 'RATE_LIMIT',
    message: 'Profile sync is busy — wait a few seconds and retry.',
  },
});

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many login attempts. Try again later.' },
  skipSuccessfulRequests: true,
});

const authSignupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many signup attempts from this IP.' },
});

const progressionEventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many progression events. Slow down.' },
});

const ebaySearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
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
  skip: rateLimitSkipDev,
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
  skip: rateLimitSkipDev,
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
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many market value lookups.' },
});

/** POST /api/auth/forgot-password — limit reset email requests per IP */
const authPasswordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many password reset attempts.' },
});

/** POST /api/auth/reset-password — limit token submission guesses */
const authPasswordResetSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many reset attempts. Try again later.' },
});

module.exports = {
  isAuthMeRequest,
  authMeLimiter,
  authLoginLimiter,
  authSignupLimiter,
  authPasswordResetLimiter,
  authPasswordResetSubmitLimiter,
  progressionEventsLimiter,
  ebaySearchLimiter,
  ebayBidLimiter,
  ebaySellerTrendsLimiter,
  marketValueLimiter,
};
