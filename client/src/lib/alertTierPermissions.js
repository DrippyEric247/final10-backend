import { getAdvantageTier, getEffectiveSubscriptionTier } from "./tierMultiplier";

/**
 * Alert creation & monitoring capabilities by subscription tier.
 * Client tier keys: free | core (Savvy+) | pro (Savvy Pro) | elite
 */
export function getAlertCreationCapabilities(tier = getEffectiveSubscriptionTier()) {
  const normalized = tier === "elite" ? "elite" : tier;
  const textAi = normalized === "pro" || normalized === "elite";
  const voiceAi = normalized === "elite";
  const adv = getAdvantageTier(tier);
  return {
    tier: normalized,
    manual: true,
    textAi,
    voiceAi,
    alertsMax: adv.alertsMax,
    alertsMode: adv.alertsMode,
    checkNote:
      normalized === "free"
        ? "Delayed checks on Free — Savvy+ and Pro are faster."
        : normalized === "core"
          ? "Faster checks than Free — Pro adds real-time priority."
          : "Real-time / priority checks on your plan.",
  };
}
