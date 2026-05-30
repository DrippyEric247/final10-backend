/**
 * Founding / Beta Tester access — unlimited caps for Best Moves, searches, alerts, Scout missions.
 */

let betaGetter = () => false;

export function registerBetaTesterGetter(fn) {
  betaGetter = typeof fn === "function" ? fn : () => false;
}

export function isBetaTester(user = null, entitlement = null) {
  if (user) {
    if (user.isBetaTester === true || user.foundingTesterAccess === true) return true;
    if (user.betaTester || user.foundingAccess) {
      if (!user.betaAccessExpiresAt) return true;
      return new Date(user.betaAccessExpiresAt) > new Date();
    }
  }
  if (entitlement?.isBetaTester || entitlement?.foundingTesterAccess) return true;
  return Boolean(betaGetter());
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
