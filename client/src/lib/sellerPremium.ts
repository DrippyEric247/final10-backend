/**
 * Seller-premium access scaffolding.
 *
 * Structure-only per the spec — we don't charge anyone here, we just
 * define the tier model, the feature catalog, and the gate helper so
 * the dashboard / alert UI can light up upgrade prompts without
 * needing a billing backend wired up yet.
 *
 * When a real subscription exists this module gains:
 *   - real entitlement read (SSR or auth context)
 *   - webhook sync on tier changes
 *   - analytics for gate views / conversion
 * Today it's intentionally minimal.
 */

export type SellerTier = "free" | "pro";

export type PremiumFeatureId =
  | "advanced_alerts"     // push + smart timing windows
  | "deep_insights"       // multi-week trend curves, comp benchmarks
  | "unlimited_alerts"    // free tier caps alerts to 3
  | "early_access_categories" // emerging categories before GA
  | "auto_flip_unlimited"; // full auto-flip list + live refresh

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

const TIER_STORAGE_KEY = "f10_seller_tier_v1";
const FREE_ALERT_CAP = 3;

/**
 * Read the local tier. Real auth integration will replace this with a
 * server-supplied entitlement; the UI only ever calls `getSellerTier`
 * so swapping the impl later is a one-liner.
 */
export function getSellerTier(): SellerTier {
  if (typeof window === "undefined") return "free";
  try {
    const raw = window.localStorage.getItem(TIER_STORAGE_KEY);
    return raw === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

/** Dev / QA helper. Not exposed anywhere in the production UI yet. */
export function setSellerTier(tier: SellerTier): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TIER_STORAGE_KEY, tier);
    window.dispatchEvent(new CustomEvent("f10:seller-tier-updated"));
  } catch {
    /* ignore */
  }
}

export function isPremiumSeller(): boolean {
  return getSellerTier() === "pro";
}

/**
 * The gate. Returns `{ allowed, reason }` so components don't have to
 * branch on tier strings.
 */
export function canUseFeature(id: PremiumFeatureId): { allowed: boolean; reason: string } {
  if (isPremiumSeller()) return { allowed: true, reason: "" };
  return {
    allowed: false,
    reason: "This insight is part of Seller Pro — coming soon.",
  };
}

export function getFreeAlertCap(): number {
  return FREE_ALERT_CAP;
}
