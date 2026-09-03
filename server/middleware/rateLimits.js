const rateLimit = require('express-rate-limit');
const { rateLimitSkipDev } = require('../lib/rateLimitDevBypass');
const { isBetaMode } = require('../config/betaMode');
const { getRouteRateCaps } = require('../config/betaMode');
const { getSoftBusyMessage } = require('./marketplaceScanLimiter');
const {
  distributedRateLimitMiddleware,
  useDistributedRateLimits,
} = require('../lib/distributedRateLimit');
const { RATE_LIMIT_CLASSIFICATION } = require('../lib/rateLimitClassification');

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

/**
 * Production: Mongo-backed shared counter. Dev / no Mongo: in-memory limiter only.
 */
function composeSecurityLimiter(name, inMemoryLimiter, opts = {}) {
  const category = RATE_LIMIT_CLASSIFICATION[name] || opts.category || 'SECURITY';
  const distributed = distributedRateLimitMiddleware({
    name,
    category,
    windowMs: opts.windowMs,
    max: opts.max,
    keyGenerator: opts.keyGenerator,
    message: opts.message,
  });
  return function composedRateLimit(req, res, next) {
    distributed(req, res, (err) => {
      if (err) return next(err);
      if (useDistributedRateLimits()) return next();
      return inMemoryLimiter(req, res, next);
    });
  };
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

const authLoginLimiterMemory = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many login attempts. Try again later.' },
  skipSuccessfulRequests: true,
});

const authSignupLimiterMemory = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many signup attempts from this IP.' },
});

const authPasswordResetLimiterMemory = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many password reset attempts.' },
});

const authPasswordResetSubmitLimiterMemory = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: { code: 'RATE_LIMIT', message: 'Too many reset attempts. Try again later.' },
});

const perkMachineSpinLimiterMemory = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().perkMachineSpin,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many spins. Wait a moment before trying again.'),
});

const scoutMissionClaimLimiterMemory = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().scoutMissionClaim,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many claim attempts. Slow down.'),
});

const scoutFlightTournamentStartLimiterMemory = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().scoutFlightTournamentStart,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many tournament starts. Wait a moment.'),
});

const scoutFlightTournamentSubmitLimiterMemory = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().scoutFlightTournamentSubmit,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many score submissions. Wait a moment.'),
});

const ebayBidLimiterMemory = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().ebayBid,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () => betaRateLimitMessage('Too many bid attempts from your session. Pause briefly and retry.'),
});

const authLoginLimiter = composeSecurityLimiter('authLoginLimiter', authLoginLimiterMemory, {
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many login attempts. Try again later.',
});

const authSignupLimiter = composeSecurityLimiter('authSignupLimiter', authSignupLimiterMemory, {
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: 'Too many signup attempts from this IP.',
});

const authPasswordResetLimiter = composeSecurityLimiter(
  'authForgotPasswordLimiter',
  authPasswordResetLimiterMemory,
  {
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many password reset attempts.',
  }
);

const authPasswordResetSubmitLimiter = composeSecurityLimiter(
  'authResetPasswordLimiter',
  authPasswordResetSubmitLimiterMemory,
  {
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many reset attempts. Try again later.',
  }
);

const perkMachineSpinLimiter = composeSecurityLimiter('perkMachineSpinLimiter', perkMachineSpinLimiterMemory, {
  windowMs: 60 * 1000,
  max: () => caps().perkMachineSpin,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: 'Too many spins. Wait a moment before trying again.',
});

const scoutMissionClaimLimiter = composeSecurityLimiter(
  'scoutMissionClaimLimiter',
  scoutMissionClaimLimiterMemory,
  {
    windowMs: 60 * 1000,
    max: () => caps().scoutMissionClaim,
    keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
    message: 'Too many claim attempts. Slow down.',
  }
);

const scoutFlightTournamentStartLimiter = composeSecurityLimiter(
  'scoutFlightTournamentStartLimiter',
  scoutFlightTournamentStartLimiterMemory,
  {
    windowMs: 60 * 1000,
    max: () => caps().scoutFlightTournamentStart,
    keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
    message: 'Too many tournament starts. Wait a moment.',
  }
);

const scoutFlightTournamentSubmitLimiter = composeSecurityLimiter(
  'scoutFlightTournamentSubmitLimiter',
  scoutFlightTournamentSubmitLimiterMemory,
  {
    windowMs: 60 * 1000,
    max: () => caps().scoutFlightTournamentSubmit,
    keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
    message: 'Too many score submissions. Wait a moment.',
  }
);

const ebayBidLimiter = composeSecurityLimiter('ebayBidLimiter', ebayBidLimiterMemory, {
  windowMs: 60 * 1000,
  max: () => caps().ebayBid,
  message: 'Too many bid attempts from your session. Pause briefly and retry.',
});

const progressionEventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().progressionEvents,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () => betaRateLimitMessage('Too many progression events. Slow down.'),
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

const ebaySellerTrendsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().ebaySellerTrends,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () => betaRateLimitMessage('Seller trend refresh limit reached. Try again in a minute.'),
});

const marketValueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().marketValue,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  message: () => betaRateLimitMessage('Too many market value lookups.'),
});

const scoutFlightHeartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().scoutFlightHeartbeat,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many heartbeats. Wait a moment.'),
});

const easterEggRedeemLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().easterEggRedeem,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many redemption attempts. Try again shortly.'),
});

const savvyWatchHeartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => (isBetaMode() ? 120 : 90),
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many Savvy Watch heartbeats. Slow down.'),
});

const savvyWatchClaimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: () => caps().easterEggRedeem || 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: () => betaRateLimitMessage('Too many Savvy Watch claims. Try again shortly.'),
});

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

const alertMutationLimiterMemory = rateLimit({
  windowMs: 60 * 1000,
  max: () => (isBetaMode() ? 60 : 30),
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: { code: 'RATE_LIMIT', message: 'Too many alert changes. Slow down.' },
});

const alertMutationLimiter = composeSecurityLimiter('alertMutationLimiter', alertMutationLimiterMemory, {
  windowMs: 60 * 1000,
  max: () => (isBetaMode() ? 60 : 30),
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: 'Too many alert changes. Slow down.',
});

const bestMoveConsumeLimiterMemory = rateLimit({
  windowMs: 60 * 1000,
  max: () => (isBetaMode() ? 120 : 60),
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitSkipDev,
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: { code: 'RATE_LIMIT', message: 'Too many Best Move requests. Slow down.' },
});

const bestMoveConsumeLimiter = composeSecurityLimiter('bestMoveConsumeLimiter', bestMoveConsumeLimiterMemory, {
  windowMs: 60 * 1000,
  max: () => (isBetaMode() ? 120 : 60),
  keyGenerator: (req) => String(req.user?.id || req.user?._id || req.ip || 'anon'),
  message: 'Too many Best Move requests. Slow down.',
});

const globalApiDistributedLimiter = distributedRateLimitMiddleware({
  name: 'globalApiLimiter',
  category: RATE_LIMIT_CLASSIFICATION.globalApiLimiter,
  windowMs: 15 * 60 * 1000,
  max: () => caps().globalApi,
  keyGenerator: (req) => String(req.ip || 'anon'),
  message: isBetaMode()
    ? 'Savvy Scout is updating — please try again shortly.'
    : 'Too many requests. Try again later.',
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
  scoutFlightHeartbeatLimiter,
  scoutMissionClaimLimiter,
  easterEggRedeemLimiter,
  savvyWatchHeartbeatLimiter,
  savvyWatchClaimLimiter,
  founderMessageLimiter,
  alertMutationLimiter,
  bestMoveConsumeLimiter,
  globalApiDistributedLimiter,
  composeSecurityLimiter,
  RATE_LIMIT_CLASSIFICATION,
};
