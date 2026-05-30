import { getAdvantageTier, getEffectiveSubscriptionTier } from "./tierMultiplier";
import { isBetaTester, getScoutMissionTier } from "./betaTesterAccess";

/**
 * Alert creation & monitoring capabilities by subscription tier.
 * Client tier keys: free | core (Savvy+) | pro (Savvy Pro) | elite
 */
export function getAlertCreationCapabilities(tier = getEffectiveSubscriptionTier()) {
  const missionTier = getScoutMissionTier(tier);
  const normalized = missionTier === "elite" ? "elite" : missionTier;
  const textAi = normalized === "pro" || normalized === "elite" || isBetaTester();
  const voiceAi = normalized === "elite" || isBetaTester();
  const adv = getAdvantageTier(missionTier);
  const alertsMax = isBetaTester() ? Number.POSITIVE_INFINITY : adv.alertsMax;
  return {
    tier: normalized,
    manual: true,
    textAi,
    voiceAi,
    alertsMax,
    alertsMode: adv.alertsMode,
    checkNote:
      normalized === "free"
        ? "Delayed checks on Free — Savvy+ and Pro are faster."
        : normalized === "core"
          ? "Faster checks than Free — Pro adds real-time priority."
          : "Real-time / priority checks on your plan.",
  };
}
