const rateLimit = require('express-rate-limit');
const { rateLimitSkipDev } = require('../lib/rateLimitDevBypass');
const { isBetaMode } = require('../config/betaMode');
const { getRouteRateCaps } = require('../config/betaMode');
const { getSoftBusyMessage } = require('./marketplaceScanLimiter');

function caps() {
  return getRouteRateCaps();
}

function betaRateLimitMessage(fallback) {
  if (isBetaMode()) {
    return {
      code: 'MARKETPLACE_BUSY',
      message: getSoftBusyMessage(),
      retryAfterSec: 60,
    };
  }
  return typeof fallback === 'string' ? { code: 'RATE_LIMIT', message: fallback } : fallback;
}

/** True for GET /api/auth/me (profile hydrate — not a credential guess). */
function isAuthMeRequest(req) {
  const path = String(req.originalUrl || req.url || req.path || '').split('?')[0];
  return req.method === 'GET' && /\/auth\/me(?:\/)?$/i.test(path);
}

/** Lenient limiter for session hydration — separate bucket from login brute-force. */
const authMeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => (isBetaMode() ? 240 : 120),
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
  max: () => caps().progressionEvents,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () =>
    betaRateLimitMessage('Too many progression events. Slow down.'),
});

/** @deprecated Route entry gate — live scans counted in marketplaceScanLimiter only. */
const ebaySearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().progressionEvents,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => true,
  message: () => betaRateLimitMessage('Too many marketplace searches right now.'),
});

const ebayBidLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().ebayBid,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () => betaRateLimitMessage('Too many bid attempts from your session. Pause briefly and retry.'),
});

/** Browse-backed seller trends runs several internal searches — keep separate from product search. */
const ebaySellerTrendsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().ebaySellerTrends,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () => betaRateLimitMessage('Seller trend refresh limit reached. Try again in a minute.'),
});

/** True Market Value comp lookups — heavier than search, so bucketed separately. */
const marketValueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().marketValue,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () => betaRateLimitMessage('Too many market value lookups.'),
});

/** Perk Machine spins — per-user cap to blunt double-tap / parallel request abuse. */
const perkMachineSpinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().perkMachineSpin,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many spins. Wait a moment before trying again.'),
});

const scoutFlightTournamentStartLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().scoutFlightTournamentStart,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many tournament starts. Wait a moment.'),
});

const scoutFlightTournamentSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().scoutFlightTournamentSubmit,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many score submissions. Wait a moment.'),
});

/** Scout mission claims — per-user cap against spam clicking Complete. */
const scoutMissionClaimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().scoutMissionClaim,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many claim attempts. Slow down.'),
});

/** Easter egg redemptions — per-user cap. */
const easterEggRedeemLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().easterEggRedeem,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many redemption attempts. Try again shortly.'),
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

/** POST /api/founder-messages — public contact relay via Savvy Scout */
const founderMessageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: {
    code: 'RATE_LIMIT',
    message: 'Too many messages sent recently. Please wait before trying again.',
  },
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
  perkMachineSpinLimiter,
  scoutFlightTournamentStartLimiter,
  scoutFlightTournamentSubmitLimiter,
  scoutMissionClaimLimiter,
  easterEggRedeemLimiter,
  founderMessageLimiter,
};
