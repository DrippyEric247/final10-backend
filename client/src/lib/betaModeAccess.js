/**
 * Global BETA_MODE client helpers — synced from GET /api/config/public.
 */

let betaModeActive = false;
let loggedInGetter = () => false;

export function setBetaModeActive(value) {
  betaModeActive = value === true;
}

export function registerLoggedInGetter(fn) {
  loggedInGetter = typeof fn === 'function' ? fn : () => false;
}

export function isBetaModeActive() {
  return betaModeActive;
}

export function isLoggedInForBetaAccess() {
  try {
    return Boolean(loggedInGetter());
  } catch {
    return false;
  }
}

/** Logged-in users receive beta_pro effective access when beta mode is on. */
export function hasBetaProAccess(user = null, entitlement = null) {
  if (!betaModeActive) return false;
  if (user && (user.id || user._id)) return true;
  if (entitlement?.betaModeProAccess) return true;
  return isLoggedInForBetaAccess();
}

export function applyBetaModeFromPublicConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return;
  setBetaModeActive(cfg.betaMode === true);
}
