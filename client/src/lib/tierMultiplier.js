import {
  getDevFeatureTests,
  getDevInternalTierOverride,
  getDevSimulateExpiredSubscription,
  saveFinal10DevOverride,
} from "./devOverride";
import { isBetaTester } from "./betaTesterAccess";
import { DAILY_LOGIN_BASE_SAVVY } from "../config/savvyRewards";

const TIER_STORAGE_KEY = "f10_subscription_tier_v1";

export const SAVVY_TIER_MULTIPLIERS = Object.freeze({
  free: 1.0,
  core: 1.25,
  pro: 1.5,
  elite: 2.0,
});

export const ADVANTAGE_TIER_CONFIG = Object.freeze({
  free: {
    id: "free",
    label: "Free",
    marketing: "FREE",
    multiplier: 1.0,
    bestMoveBoostedPerDay: 3,
    alertsMode: "delayed",
    alertsMax: 3,
    dailyLoginBonus: 0.5,
    sellerSignals: false,
    visibilityBoost: false,
    projectAlertsEnabled: false,
    projectActiveMax: 0,
    projectItemsMaxPerProject: 0,
    projectBundleSavings: false,
    projectPriceTargetsPerItem: false,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
  },
  core: {
    id: "core",
    label: "CORE",
    marketing: "CORE",
    multiplier: 1.25,
    bestMoveBoostedPerDay: 5,
    alertsMode: "semi_fast",
    alertsMax: 10,
    dailyLoginBonus: 0.75,
    sellerSignals: false,
    visibilityBoost: false,
    projectAlertsEnabled: true,
    projectActiveMax: 1,
    projectItemsMaxPerProject: 5,
    projectBundleSavings: false,
    projectPriceTargetsPerItem: false,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
  },
  pro: {
    id: "pro",
    label: "PRO",
    marketing: "PRO",
    multiplier: 1.5,
    bestMoveBoostedPerDay: 15,
    alertsMode: "real_time",
    alertsMax: 25,
    dailyLoginBonus: 1.0,
    sellerSignals: true,
    visibilityBoost: true,
    projectAlertsEnabled: true,
    projectActiveMax: 3,
    projectItemsMaxPerProject: 15,
    projectBundleSavings: true,
    projectPriceTargetsPerItem: true,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
  },
  elite: {
    id: "elite",
    label: "ELITE",
    marketing: "ELITE",
    multiplier: 2.0,
    bestMoveBoostedPerDay: Number.POSITIVE_INFINITY,
    alertsMode: "priority",
    alertsMax: Number.POSITIVE_INFINITY,
    dailyLoginBonus: 1.25,
    sellerSignals: true,
    visibilityBoost: true,
    projectAlertsEnabled: true,
    projectActiveMax: Number.POSITIVE_INFINITY,
    projectItemsMaxPerProject: Number.POSITIVE_INFINITY,
    projectBundleSavings: true,
    projectPriceTargetsPerItem: true,
    projectAiPartsList: true,
    projectVoiceCreation: true,
    projectAllPartsReadyNotify: true,
    projectPriorityAlerts: true,
  },
});

export function normalizeSubscriptionTier(rawTier, isPremium = false) {
  const tier = String(rawTier || "").toLowerCase();
  if (!isPremium) return "free";
  if (tier === "elite" || tier.includes("35")) return "elite";
  if (tier === "pro" || tier.includes("14") || tier === "savvy_pro") return "pro";
  if (tier === "core" || tier.includes("plus") || tier.includes("premium") || tier.includes("7") || tier === "savvy_plus") return "core";
  return "core";
}

export function setCurrentSubscriptionTier(tier) {
  const normalized = normalizeSubscriptionTier(tier, tier !== "free");
  try {
    localStorage.setItem(TIER_STORAGE_KEY, normalized);
    window.dispatchEvent(new CustomEvent("f10:subscription-tier-updated"));
  } catch {
    /* ignore */
  }
  return normalized;
}

export function getCurrentSubscriptionTier() {
  try {
    const raw = localStorage.getItem(TIER_STORAGE_KEY);
    if (!raw) return "free";
    const tier = String(raw).toLowerCase();
    if (tier === "core" || tier === "pro" || tier === "elite" || tier === "free") return tier;
    if (tier === "savvy_plus") return "core";
    if (tier === "savvy_pro") return "pro";
  } catch {
    /* ignore */
  }
  return "free";
}

/** Dispatched when dev tier override changes (non-production only). */
export const DEV_SUBSCRIPTION_TOOLS_EVENT = "f10:dev-subscription-tools-updated";

/** Dev-only: reset daily boosted Best Move usage (see DevOverridePanel). */
export const DEV_BEST_MOVE_USAGE_RESET_EVENT = "f10:dev-best-move-usage-reset";

export function isNonProductionBuild() {
  try {
    return typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

/**
 * Dev-only subscription tier override for local testing.
 * When unset, falls back to `getCurrentSubscriptionTier()` (API / localStorage).
 */
export function getDevSubscriptionTierOverride() {
  if (!isNonProductionBuild()) return null;
  return getDevInternalTierOverride();
}

export function setDevSubscriptionTierOverride(tier) {
  if (!isNonProductionBuild()) return;
  const t = String(tier || "free").toLowerCase();
  if (t !== "free" && t !== "core" && t !== "pro" && t !== "elite") return;
  const marketing =
    t === "free" ? "free" : t === "core" ? "premium" : t === "pro" ? "pro" : "lifetime";
  saveFinal10DevOverride({ subscription: marketing });
  setCurrentSubscriptionTier(t);
}

export function clearDevSubscriptionTierOverride() {
  if (!isNonProductionBuild()) return;
  saveFinal10DevOverride({ subscription: null });
}

/** Tier used for caps, gating, and dev tools (prefers dev override when enabled). */
export function getEffectiveSubscriptionTier() {
  if (isNonProductionBuild() && getDevSimulateExpiredSubscription()) {
    return "free";
  }
  const dev = getDevSubscriptionTierOverride();
  if (dev) return dev;
  return getCurrentSubscriptionTier();
}

/** Quick Snipes boosted-search credits respect effective tier unless dev forces “locked”. */
export function getTierForQuickSnipesBoost() {
  const base = getEffectiveSubscriptionTier();
  if (!isNonProductionBuild()) return base;
  if (getDevFeatureTests().lockQuickSnipes) return "free";
  return base;
}

/** Auctions auto-refresh cadence — faster when dev toggle is on. */
export function getAuctionPollIntervalMs() {
  if (!isNonProductionBuild()) return 45000;
  return getDevFeatureTests().fasterRefresh ? 12000 : 45000;
}

export function getTierMultiplier(tier = getEffectiveSubscriptionTier()) {
  return SAVVY_TIER_MULTIPLIERS[tier] || SAVVY_TIER_MULTIPLIERS.free;
}

export function getAdvantageTier(tier = getEffectiveSubscriptionTier()) {
  return ADVANTAGE_TIER_CONFIG[tier] || ADVANTAGE_TIER_CONFIG.free;
}

export function formatTierMultiplierLabel(tier = getEffectiveSubscriptionTier()) {
  const mult = getTierMultiplier(tier);
  if (mult === 1) return "1.0x";
  if (mult === 1.25) return "1.25x";
  if (mult === 1.5) return "1.5x";
  if (mult === 2) return "2.0x";
  return `${mult.toFixed(2)}x`;
}

export function applyTierMultiplier(amount, tier = getEffectiveSubscriptionTier()) {
  const base = Number(amount);
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * getTierMultiplier(tier));
}

export function buildDailyLoginReward(baseReward = DAILY_LOGIN_BASE_SAVVY, tier = getEffectiveSubscriptionTier()) {
  const amount = applyTierMultiplier(baseReward, tier);
  if (tier === "elite") {
    return {
      amount,
      title: `+${amount} Savvy`,
      subtitle: "⚡ Elite Boost Applied",
      multiplierLabel: formatTierMultiplierLabel(tier),
    };
  }
  if (tier === "pro") {
    return {
      amount,
      title: `+${amount} Savvy`,
      subtitle: "Pro Boost Applied",
      multiplierLabel: formatTierMultiplierLabel(tier),
    };
  }
  if (tier === "core") {
    return {
      amount,
      title: `+${amount} Savvy`,
      subtitle: "Core Boost Applied",
      multiplierLabel: formatTierMultiplierLabel(tier),
    };
  }
  return {
    amount,
    title: `+${amount} Savvy`,
    subtitle: "Daily reward claimed",
    multiplierLabel: formatTierMultiplierLabel(tier),
  };
}

export function getBestMoveBoostedCap(tier = getEffectiveSubscriptionTier()) {
  if (isBetaTester()) return Number.POSITIVE_INFINITY;
  return getAdvantageTier(tier).bestMoveBoostedPerDay;
}

export function getAlertLimit(tier = getEffectiveSubscriptionTier()) {
  if (isBetaTester()) return Number.POSITIVE_INFINITY;
  return getAdvantageTier(tier).alertsMax;
}

/** Project Alerts caps & feature flags (must stay aligned with server `subscriptionPlans`). */
export function getProjectAlertCapabilities(tier = getEffectiveSubscriptionTier()) {
  const adv = getAdvantageTier(tier);
  return {
    tier,
    enabled: Boolean(adv.projectAlertsEnabled),
    maxActiveProjects: adv.projectActiveMax,
    maxItemsPerProject: adv.projectItemsMaxPerProject,
    bundleSavings: Boolean(adv.projectBundleSavings),
    priceTargetPerItem: Boolean(adv.projectPriceTargetsPerItem),
    aiPartsList: Boolean(adv.projectAiPartsList),
    voiceProjectCreation: Boolean(adv.projectVoiceCreation),
    allPartsReadyNotify: Boolean(adv.projectAllPartsReadyNotify),
    priorityProjectAlerts: Boolean(adv.projectPriorityAlerts),
  };
}
