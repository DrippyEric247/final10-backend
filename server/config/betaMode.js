/**
 * Global closed-beta switch.
 *
 * BETA_MODE=true  → all authenticated users get Pro-tier effective access;
 *                   generous limits + hidden abuse caps; soft rate-limit UX.
 * BETA_MODE=false → normal Free / Premium / Pro enforcement.
 */

const { envFlag } = require('./envValidation');

const BETA_PRO_TIER = 'pro';

/** Tier caps applied to every logged-in user while beta mode is on. */
const BETA_MODE_ACCESS = Object.freeze({
  bestMovesPerDay: Number.POSITIVE_INFINITY,
  alertsMax: Number.POSITIVE_INFINITY,
  projectAlertsEnabled: true,
  projectActiveMax: Number.POSITIVE_INFINITY,
  projectItemsMaxPerProject: Number.POSITIVE_INFINITY,
  alertsSpeed: 'fastest',
  label: 'Beta Pro',
  marketingName: 'Beta Pro',
});

/** Per-minute live marketplace scan caps (only successful external fetches with results). */
const LIVE_SCAN_CAPS = Object.freeze({
  production: 90,
  beta: 480,
  betaAbuse: 900,
});

/** express-rate-limit max values — production vs beta (auth stays strict). */
const ROUTE_RATE_CAPS = Object.freeze({
  production: {
    ebayBid: 40,
    ebaySellerTrends: 20,
    marketValue: 60,
    perkMachineSpin: 20,
    scoutFlightTournamentStart: 12,
    scoutFlightTournamentSubmit: 20,
    scoutMissionClaim: 30,
    easterEggRedeem: 15,
    progressionEvents: 120,
    globalApi: 100,
  },
  beta: {
    ebayBid: 200,
    ebaySellerTrends: 120,
    marketValue: 300,
    perkMachineSpin: 120,
    scoutFlightTournamentStart: 60,
    scoutFlightTournamentSubmit: 90,
    scoutMissionClaim: 180,
    easterEggRedeem: 60,
    progressionEvents: 600,
    globalApi: 4000,
  },
});

function isBetaMode() {
  return envFlag('BETA_MODE');
}

function hasAuthenticatedUser(reqOrUser) {
  if (!reqOrUser) return false;
  const user = reqOrUser.user || reqOrUser;
  return Boolean(user && (user._id || user.id));
}

/** Logged-in users receive beta_pro effective access when beta mode is active. */
function hasBetaProAccess(userOrReq) {
  if (!isBetaMode()) return false;
  return hasAuthenticatedUser(userOrReq);
}

function getLiveScanCap() {
  if (!isBetaMode()) return LIVE_SCAN_CAPS.production;
  return LIVE_SCAN_CAPS.beta;
}

function getLiveScanAbuseCap() {
  return isBetaMode() ? LIVE_SCAN_CAPS.betaAbuse : LIVE_SCAN_CAPS.production * 2;
}

function getRouteRateCaps() {
  return isBetaMode() ? ROUTE_RATE_CAPS.beta : ROUTE_RATE_CAPS.production;
}

function getBetaModeAccessOverrides() {
  return BETA_MODE_ACCESS;
}

function getBetaProTier() {
  return BETA_PRO_TIER;
}

module.exports = {
  isBetaMode,
  hasAuthenticatedUser,
  hasBetaProAccess,
  getLiveScanCap,
  getLiveScanAbuseCap,
  getRouteRateCaps,
  getBetaModeAccessOverrides,
  getBetaProTier,
  BETA_PRO_TIER,
  BETA_MODE_ACCESS,
};
