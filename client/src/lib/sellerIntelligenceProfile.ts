/**
 * Personalized Seller Signals — category prefs, density mode, and
 * interaction weights (local + keyed by user id when logged in).
 * Mirrors onto `user` object in memory for components that read profile.
 */

export const SELLER_SIGNAL_CATEGORY_OPTIONS = [
  { id: "sneakers", label: "Sneakers" },
  { id: "electronics", label: "Electronics" },
  { id: "luxury", label: "Luxury" },
  { id: "home_garden", label: "Home & Garden" },
  { id: "automotive", label: "Automotive" },
  { id: "gaming", label: "Gaming" },
  { id: "collectibles", label: "Collectibles" },
  { id: "watches", label: "Watches" },
  { id: "fashion", label: "Fashion" },
  { id: "tools", label: "Tools" },
  { id: "trading_cards", label: "Trading Cards" },
  { id: "furniture", label: "Furniture" },
  { id: "appliances", label: "Appliances" },
  { id: "cameras", label: "Cameras" },
  { id: "other", label: "Other" },
] as const;

export type SellerSignalCategoryId = (typeof SELLER_SIGNAL_CATEGORY_OPTIONS)[number]["id"];

export type SellerIntelligenceMode = "casual" | "pro" | "elite";

export type SellerIntelligenceProfile = {
  /** Auth user id when saved while logged in; used to avoid cross-account bleed. */
  userId: string | null;
  setupComplete: boolean;
  categories: SellerSignalCategoryId[];
  mode: SellerIntelligenceMode;
  /** Heavier categories get higher feed weight (incremented on card engagement). */
  categoryWeights: Partial<Record<SellerSignalCategoryId, number>>;
};

const STORAGE_PREFIX = "f10_seller_signals_profile_v1";

export const SELLER_INTEL_PROFILE_EVENT = "f10:seller-intel-profile";

function storageKey(userId: string | null | undefined): string {
  const id = userId ? String(userId) : "anon";
  return `${STORAGE_PREFIX}_${id}`;
}

const defaultProfile = (userId: string | null = null): SellerIntelligenceProfile => ({
  userId,
  setupComplete: false,
  categories: [],
  mode: "pro",
  categoryWeights: {},
});

function safeRead(userId: string | null | undefined): SellerIntelligenceProfile {
  if (typeof window === "undefined") return defaultProfile(userId ? String(userId) : null);
  const uid = userId ? String(userId) : null;
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return defaultProfile(uid);
    const p = JSON.parse(raw) as Partial<SellerIntelligenceProfile>;
    const mode: SellerIntelligenceMode =
      p.mode === "casual" || p.mode === "pro" || p.mode === "elite" ? p.mode : "pro";
    const cats = Array.isArray(p.categories)
      ? (p.categories.filter((c) =>
          SELLER_SIGNAL_CATEGORY_OPTIONS.some((o) => o.id === c)
        ) as SellerSignalCategoryId[])
      : [];
    const weights: Partial<Record<SellerSignalCategoryId, number>> = {};
    if (p.categoryWeights && typeof p.categoryWeights === "object") {
      for (const [k, v] of Object.entries(p.categoryWeights)) {
        if (SELLER_SIGNAL_CATEGORY_OPTIONS.some((o) => o.id === k) && typeof v === "number") {
          weights[k as SellerSignalCategoryId] = Math.max(0, v);
        }
      }
    }
    return {
      userId: uid,
      setupComplete: Boolean(p.setupComplete),
      categories: cats,
      mode,
      categoryWeights: weights,
    };
  } catch {
    return defaultProfile(uid);
  }
}

function emit(): void {
  try {
    window.dispatchEvent(new CustomEvent(SELLER_INTEL_PROFILE_EVENT));
  } catch {
    /* ignore */
  }
}

function write(profile: SellerIntelligenceProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(profile.userId), JSON.stringify(profile));
  } catch {
    /* ignore */
  }
  emit();
}

export function getSellerIntelligenceProfile(userId: string | null | undefined): SellerIntelligenceProfile {
  return safeRead(userId);
}

export function saveSellerIntelligenceProfile(
  patch: Partial<Omit<SellerIntelligenceProfile, "userId">> & { userId?: string | null }
): SellerIntelligenceProfile {
  const uid = patch.userId !== undefined ? patch.userId : null;
  const prev = safeRead(uid);
  const mergedWeights =
    patch.categoryWeights != null
      ? { ...prev.categoryWeights, ...patch.categoryWeights }
      : prev.categoryWeights;
  const next: SellerIntelligenceProfile = {
    userId: uid,
    setupComplete: patch.setupComplete ?? prev.setupComplete,
    categories: (patch.categories ?? prev.categories) as SellerSignalCategoryId[],
    mode: patch.mode ?? prev.mode,
    categoryWeights: mergedWeights,
  };
  write(next);
  return next;
}

export function completeSellerSignalsSetup(
  userId: string | null | undefined,
  categories: SellerSignalCategoryId[]
): SellerIntelligenceProfile {
  const uid = userId ? String(userId) : null;
  return saveSellerIntelligenceProfile({
    userId: uid,
    setupComplete: true,
    categories: categories.length ? categories : ["other"],
  });
}

export function setSellerIntelligenceMode(mode: SellerIntelligenceMode, userId?: string | null): void {
  const uid = userId === undefined ? null : userId;
  const prev = safeRead(uid);
  saveSellerIntelligenceProfile({
    userId: uid,
    mode,
    setupComplete: prev.setupComplete,
    categories: prev.categories,
    categoryWeights: prev.categoryWeights,
  });
}

/** Call when user opens a signal card or taps CTA — boosts feed ranking for that lane. */
export function recordSellerCategoryEngagement(
  categoryId: SellerSignalCategoryId,
  userId?: string | null
): void {
  const uid = userId === undefined ? null : userId;
  const prev = safeRead(uid);
  const cur = prev.categoryWeights[categoryId] ?? 0;
  const nextW = { ...prev.categoryWeights, [categoryId]: cur + 1 };
  saveSellerIntelligenceProfile({ userId: uid, categoryWeights: nextW });
}
