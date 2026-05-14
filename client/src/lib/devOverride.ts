/**
 * Final10 development-only overrides (subscription simulation, feature tests, fake points).
 * Never enable in production builds — consumers must guard UI with `isDev`.
 */

export const isDev = process.env.NODE_ENV !== "production";

/** Placeholder email fragment from spec; optionally set `REACT_APP_DEV_EMAIL` in `.env.local`. */
const DEFAULT_DEV_EMAIL = "your@email.com";

export function isDeveloper(user: { email?: string | null } | null | undefined): boolean {
  const marker =
    (typeof process !== "undefined" &&
      process.env &&
      (process.env.REACT_APP_DEV_EMAIL as string | undefined)) ||
    DEFAULT_DEV_EMAIL;
  const email = String(user?.email || "").toLowerCase();
  return Boolean(marker && email.includes(String(marker).toLowerCase()));
}

export const FINAL10_DEV_OVERRIDE_STORAGE_KEY = "final10_dev_override";

export const FINAL10_DEV_OVERRIDE_EVENT = "final10:dev-override-updated";

export type DevMarketingSubscription =
  | "free"
  | "premium"
  | "pro"
  | "lifetime"
  | "veteran_program"
  | "first_responder_program"
  | "legacy_program";

export type DevFeatureTests = {
  lockQuickSnipes: boolean;
  premiumDealReveal: boolean;
  premiumAiHints: boolean;
  fasterRefresh: boolean;
  premiumBadges: boolean;
  savvyPrograms: boolean;
  leaderboardEffects: boolean;
};

export type Final10DevOverrideV1 = {
  version: 1;
  /** When `null`, subscription tier follows API / stored tier only. */
  subscription: DevMarketingSubscription | null;
  savvyPointsOffset: number;
  simulateExpiredSubscription: boolean;
  featureTests: DevFeatureTests;
};

const LEGACY_DEV_TIER_KEY = "f10_dev_subscription_tier_v1";

const DEFAULT_FEATURE_TESTS: DevFeatureTests = {
  lockQuickSnipes: false,
  premiumDealReveal: false,
  premiumAiHints: false,
  fasterRefresh: false,
  premiumBadges: false,
  savvyPrograms: false,
  leaderboardEffects: false,
};

export const DEFAULT_DEV_OVERRIDE: Final10DevOverrideV1 = {
  version: 1,
  subscription: null,
  savvyPointsOffset: 0,
  simulateExpiredSubscription: false,
  featureTests: { ...DEFAULT_FEATURE_TESTS },
};

function safeParse(raw: string | null): Final10DevOverrideV1 | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<Final10DevOverrideV1>;
    if (!o || o.version !== 1) return null;
    return {
      version: 1,
      subscription:
        o.subscription === undefined
          ? null
          : (o.subscription as DevMarketingSubscription | null),
      savvyPointsOffset: Number.isFinite(Number(o.savvyPointsOffset))
        ? Math.round(Number(o.savvyPointsOffset))
        : 0,
      simulateExpiredSubscription: Boolean(o.simulateExpiredSubscription),
      featureTests: { ...DEFAULT_FEATURE_TESTS, ...(o.featureTests || {}) },
    };
  } catch {
    return null;
  }
}

function migrateLegacyDevTier(): DevMarketingSubscription | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = String(window.localStorage.getItem(LEGACY_DEV_TIER_KEY) || "").toLowerCase();
    if (!raw) return null;
    const map: Record<string, DevMarketingSubscription> = {
      free: "free",
      core: "premium",
      pro: "pro",
      elite: "lifetime",
    };
    const sub = map[raw];
    if (sub) window.localStorage.removeItem(LEGACY_DEV_TIER_KEY);
    return sub || null;
  } catch {
    return null;
  }
}

export function loadFinal10DevOverride(): Final10DevOverrideV1 {
  if (!isDev || typeof window === "undefined") return { ...DEFAULT_DEV_OVERRIDE };
  try {
    const parsed = safeParse(window.localStorage.getItem(FINAL10_DEV_OVERRIDE_STORAGE_KEY));
    if (parsed) return parsed;
    const migratedSub = migrateLegacyDevTier();
    const base = { ...DEFAULT_DEV_OVERRIDE, subscription: migratedSub };
    window.localStorage.setItem(FINAL10_DEV_OVERRIDE_STORAGE_KEY, JSON.stringify(base));
    return base;
  } catch {
    return { ...DEFAULT_DEV_OVERRIDE };
  }
}

export function saveFinal10DevOverride(patch: Partial<Final10DevOverrideV1>): Final10DevOverrideV1 {
  if (!isDev || typeof window === "undefined") return { ...DEFAULT_DEV_OVERRIDE };
  const prev = loadFinal10DevOverride();
  const next: Final10DevOverrideV1 = {
    ...prev,
    ...patch,
    featureTests: { ...prev.featureTests, ...(patch.featureTests || {}) },
  };
  try {
    window.localStorage.setItem(FINAL10_DEV_OVERRIDE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(FINAL10_DEV_OVERRIDE_EVENT));
    window.dispatchEvent(new CustomEvent("f10:subscription-tier-updated"));
    // Keep legacy listeners working (BattlePass dev tools, LocalDeals, etc.)
    window.dispatchEvent(new CustomEvent("f10:dev-subscription-tools-updated"));
  } catch {
    /* ignore */
  }
  return next;
}

/** Maps marketing subscription labels → internal tierMultiplier tier ids. */
export function marketingSubscriptionToInternalTier(
  sub: DevMarketingSubscription | null
): "free" | "core" | "pro" | "elite" | null {
  if (!sub || sub === "free") return sub === "free" ? "free" : null;
  if (sub === "premium") return "core";
  if (sub === "pro") return "pro";
  if (sub === "lifetime") return "elite";
  if (sub === "veteran_program" || sub === "first_responder_program") return "elite";
  if (sub === "legacy_program") return "elite";
  return null;
}

/**
 * Effective marketing-tier string for dev tooling (what the panel selected).
 * When no override, returns `null` — callers should fall back to real/API tier strings as needed.
 */
export function getDevMarketingSubscription(): DevMarketingSubscription | null {
  if (!isDev) return null;
  return loadFinal10DevOverride().subscription;
}

export function getDevSavvyPointsOffset(): number {
  if (!isDev) return 0;
  return loadFinal10DevOverride().savvyPointsOffset || 0;
}

export function bumpDevSavvyPointsOffset(delta: number): number {
  if (!isDev) return 0;
  const cur = loadFinal10DevOverride().savvyPointsOffset || 0;
  const next = Math.max(0, Math.round(cur + delta));
  saveFinal10DevOverride({ savvyPointsOffset: next });
  return next;
}

export function resetDevSavvyPointsOffset(): void {
  if (!isDev) return;
  saveFinal10DevOverride({ savvyPointsOffset: 0 });
}

export function getDevSimulateExpiredSubscription(): boolean {
  if (!isDev) return false;
  return Boolean(loadFinal10DevOverride().simulateExpiredSubscription);
}

export function getDevFeatureTests(): DevFeatureTests {
  if (!isDev) return { ...DEFAULT_FEATURE_TESTS };
  return { ...DEFAULT_FEATURE_TESTS, ...loadFinal10DevOverride().featureTests };
}

/** Internal tier override for `tierMultiplier` (`null` = no dev tier override). */
export function getDevInternalTierOverride(): "free" | "core" | "pro" | "elite" | null {
  if (!isDev || getDevSimulateExpiredSubscription()) return null;
  const sub = loadFinal10DevOverride().subscription;
  if (sub == null) return null;
  return marketingSubscriptionToInternalTier(sub);
}

export function effectiveDevMarketingSubscription(realMarketing: string | null): DevMarketingSubscription | null {
  if (!isDev) return null;
  const o = loadFinal10DevOverride().subscription;
  if (o != null) return o;
  return (realMarketing as DevMarketingSubscription) || null;
}

/** Spec: premium / pro / lifetime → premium access. Program tiers use elite internally but are separate labels. */
export function devMarketingHasPremium(sub: DevMarketingSubscription | null): boolean {
  if (!sub) return false;
  return sub === "premium" || sub === "pro" || sub === "lifetime";
}

export function getDevEntitlementOverlay():
  | { isPremium: boolean; premiumTier: string; premiumStatus: string }
  | null {
  if (!isDev) return null;
  const sim = getDevSimulateExpiredSubscription();
  const sub = loadFinal10DevOverride().subscription;
  if (sim) {
    return {
      isPremium: false,
      premiumTier: "free",
      premiumStatus: "inactive",
    };
  }
  if (sub == null) return null;
  const internal = marketingSubscriptionToInternalTier(sub);
  const isPaid = Boolean(internal && internal !== "free");
  return {
    isPremium: isPaid,
    premiumTier: internal || "free",
    premiumStatus: isPaid ? "active" : "inactive",
  };
}
