/**
 * Rate limit classification for Wave 7 operational docs.
 *
 * SECURITY — auth abuse, credential stuffing, admin bootstrap
 * ABUSE — automated scraping/spam on expensive endpoints
 * PRODUCT_QUOTA — tier/beta generous usage caps (marketplace scans, etc.)
 */

const RATE_LIMIT_CLASSIFICATION = Object.freeze({
  authLoginLimiter: 'SECURITY',
  authSignupLimiter: 'SECURITY',
  authForgotPasswordLimiter: 'SECURITY',
  authResetPasswordLimiter: 'SECURITY',
  authMeLimiter: 'ABUSE',
  alertMutationLimiter: 'SECURITY',
  bestMoveConsumeLimiter: 'SECURITY',
  globalApiLimiter: 'ABUSE',
  perkMachineSpinLimiter: 'SECURITY',
  scoutMissionClaimLimiter: 'SECURITY',
  scoutFlightTournamentStartLimiter: 'SECURITY',
  scoutFlightTournamentSubmitLimiter: 'SECURITY',
  scoutFlightHeartbeatLimiter: 'ABUSE',
  ebayBidLimiter: 'SECURITY',
  marketValueLimiter: 'PRODUCT_QUOTA',
  ebaySearchLimiter: 'PRODUCT_QUOTA',
  marketplaceScanLimiter: 'PRODUCT_QUOTA',
  progressionEventsLimiter: 'PRODUCT_QUOTA',
});

module.exports = { RATE_LIMIT_CLASSIFICATION };
