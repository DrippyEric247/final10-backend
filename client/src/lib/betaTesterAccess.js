/**
 * Founding / Beta Tester access — unlimited caps for Best Moves, searches, alerts, Scout missions.
 */

let betaGetter = () => false;

export function registerBetaTesterGetter(fn) {
  betaGetter = typeof fn === "function" ? fn : () => false;
}

function evaluateBetaFromUser(user) {
  if (!user) return false;
  if (user.isBetaTester === true || user.foundingTesterAccess === true) return true;
  if (user.betaTester || user.foundingAccess) {
    if (!user.betaAccessExpiresAt) return true;
    return new Date(user.betaAccessExpiresAt) > new Date();
  }
  return false;
}

function evaluateBetaFromEntitlement(entitlement) {
  if (!entitlement) return false;
  return Boolean(entitlement.isBetaTester || entitlement.foundingTesterAccess);
}

/**
 * When `user` and/or `entitlement` are passed, evaluate those only — never fall through
 * to `betaGetter` (avoids infinite recursion with registerBetaTesterGetter).
 */
export function isBetaTester(user = null, entitlement = null) {
  if (evaluateBetaFromUser(user)) return true;
  if (evaluateBetaFromEntitlement(entitlement)) return true;
  if (user != null || entitlement != null) return false;
  try {
    return Boolean(betaGetter());
  } catch {
    return false;
  }
}

export const FOUNDING_TESTER_BADGE = "Founding Tester";
export const FOUNDING_TESTER_THANKS = "Thanks for helping shape Final10.";

export function getBestMoveBoostedCapForAccess(tierCap, user, entitlement) {
  if (isBetaTester(user, entitlement)) return Number.POSITIVE_INFINITY;
  return tierCap;
}

export function getAlertsMaxForAccess(tierMax, user, entitlement) {
  if (isBetaTester(user, entitlement)) return Number.POSITIVE_INFINITY;
  return tierMax;
}

/** Scout / assistant mission tier — beta testers get full elite capabilities. */
export function getScoutMissionTier(effectiveTier, user, entitlement) {
  if (isBetaTester(user, entitlement)) return "elite";
  return effectiveTier;
}
