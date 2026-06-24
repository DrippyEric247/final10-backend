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
  const voiceAi = normalized === "pro" || normalized === "elite" || isBetaTester();
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
        ? "Basic delayed checks on Free — Premium and Pro are faster."
        : normalized === "core"
          ? "Faster checks than Free — Pro adds fastest priority."
          : "Fastest / priority checks on your plan.",
  };
}
