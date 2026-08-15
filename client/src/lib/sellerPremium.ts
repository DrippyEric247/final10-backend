/**
 * Seller-premium access — reads canonical server entitlements (Wave 2 closure).
 */

import { getAuthoritativeEffectivePlan } from "./entitlementCache";

export type SellerTier = "free" | "pro";

export type PremiumFeatureId =
  | "advanced_alerts"
  | "deep_insights"
  | "unlimited_alerts"
  | "early_access_categories"
  | "auto_flip_unlimited";

export type PremiumFeature = {
  id: PremiumFeatureId;
  label: string;
  blurb: string;
};

export const PREMIUM_FEATURES: ReadonlyArray<PremiumFeature> = [
  {
    id: "advanced_alerts",
    label: "Advanced alerts",
    blurb: "Ping the minute a lane heats up — hour-level windows, not vague “sometime today.”",
  },
  {
    id: "deep_insights",
    label: "Deep insights",
    blurb: "Weeks of demand curves and lane benchmarks so you price for profit, not hope.",
  },
  {
    id: "unlimited_alerts",
    label: "Unlimited alerts",
    blurb: "Watch every hot category — free tier stops at three signals.",
  },
  {
    id: "early_access_categories",
    label: "Early category access",
    blurb: "See the next money lanes before they hit the public map.",
  },
  {
    id: "auto_flip_unlimited",
    label: "Full flip radar",
    blurb: "Every scored buy-low lane with a faster refresh — not just the two teaser cards.",
  },
];

const FREE_ALERT_CAP = 3;

export function getSellerTier(): SellerTier {
  const plan = getAuthoritativeEffectivePlan();
  return plan === "pro" ? "pro" : "free";
}

/** Dev-only local override removed from production authorization path. */
export function setSellerTier(_tier: SellerTier): void {
  /* no-op — server entitlements are authoritative */
}

export function isPremiumSeller(): boolean {
  return getSellerTier() === "pro";
}

export function canUseFeature(id: PremiumFeatureId): { allowed: boolean; reason: string } {
  if (isPremiumSeller()) return { allowed: true, reason: "" };
  return {
    allowed: false,
    reason: "This insight is part of Seller Pro — upgrade to Pro for access.",
  };
}

export function getFreeAlertCap(): number {
  return FREE_ALERT_CAP;
}
