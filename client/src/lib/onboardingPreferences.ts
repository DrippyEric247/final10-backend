/**
 * Post-onboarding "Instant Best Move" preference state.
 *
 * Lives in localStorage for anonymous visitors and newly-registered users.
 * The server can later hydrate from this snapshot (e.g. on first
 * authenticated request) but the client is the source of truth for the
 * first-run moment so the UI never has to wait on a round-trip before
 * showing the user their first personalized deal.
 */

export type InterestId =
  | "gaming"
  | "tech"
  | "sneakers"
  | "fashion"
  | "collectibles"
  | "home"
  | "auto";

export const MAX_INTERESTS = 3;
export const MIN_INTERESTS = 1;

const SELECTED_KEY = "f10_onboarding_interests_v1";
const COMPLETED_KEY = "f10_onboarding_completed_v1";
const FIRST_MOVE_SHOWN_AT_KEY = "f10_first_best_move_shown_at_v1";
const FIRST_MOVE_CATEGORY_KEY = "f10_first_best_move_category_v1";
const FIRST_MOVE_LISTING_KEY = "f10_first_best_move_listing_v1";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

const VALID_INTERESTS: ReadonlySet<InterestId> = new Set<InterestId>([
  "gaming",
  "tech",
  "sneakers",
  "fashion",
  "collectibles",
  "home",
  "auto",
]);

export function getSelectedInterests(): InterestId[] {
  const raw = safeGet(SELECTED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed
      .map((v) => String(v || "").toLowerCase())
      .filter((v): v is InterestId => VALID_INTERESTS.has(v as InterestId));
    // Preserve order but dedupe and cap at MAX_INTERESTS.
    const seen = new Set<InterestId>();
    const out: InterestId[] = [];
    for (const id of cleaned) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= MAX_INTERESTS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function setSelectedInterests(interests: InterestId[]): void {
  const seen = new Set<InterestId>();
  const out: InterestId[] = [];
  for (const raw of interests) {
    const id = String(raw || "").toLowerCase() as InterestId;
    if (!VALID_INTERESTS.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_INTERESTS) break;
  }
  safeSet(SELECTED_KEY, JSON.stringify(out));
}

export function clearSelectedInterests(): void {
  safeRemove(SELECTED_KEY);
}

export function hasCompletedOnboarding(): boolean {
  return safeGet(COMPLETED_KEY) === "1";
}

export function markOnboardingCompleted(): void {
  const wasComplete = safeGet(COMPLETED_KEY) === "1";
  safeSet(COMPLETED_KEY, "1");
  if (!wasComplete && typeof window !== "undefined") {
    import("./analytics")
      .then((m) => {
        m.trackEvent("onboarding_completed", {});
        m.trackEvent("onboarding_complete", {});
      })
      .catch(() => {});
  }
}

export function resetOnboardingCompleted(): void {
  safeRemove(COMPLETED_KEY);
}

export type FirstBestMoveSnapshot = {
  shownAt: number | null;
  category: InterestId | null;
  listingId: string | null;
};

export function recordFirstBestMove(
  category: InterestId | null,
  listingId: string | null
): FirstBestMoveSnapshot {
  const shownAt = Date.now();
  safeSet(FIRST_MOVE_SHOWN_AT_KEY, String(shownAt));
  if (category) safeSet(FIRST_MOVE_CATEGORY_KEY, category);
  else safeRemove(FIRST_MOVE_CATEGORY_KEY);
  if (listingId) safeSet(FIRST_MOVE_LISTING_KEY, listingId);
  else safeRemove(FIRST_MOVE_LISTING_KEY);
  return { shownAt, category, listingId };
}

export function getFirstBestMoveSnapshot(): FirstBestMoveSnapshot {
  const shownAtRaw = safeGet(FIRST_MOVE_SHOWN_AT_KEY);
  const shownAt = shownAtRaw ? Number(shownAtRaw) : null;
  const category = (safeGet(FIRST_MOVE_CATEGORY_KEY) || null) as
    | InterestId
    | null;
  const listingId = safeGet(FIRST_MOVE_LISTING_KEY) || null;
  return {
    shownAt: Number.isFinite(shownAt as number) ? (shownAt as number) : null,
    category: category && VALID_INTERESTS.has(category) ? category : null,
    listingId,
  };
}

export function resetOnboardingPreferences(): void {
  safeRemove(SELECTED_KEY);
  safeRemove(COMPLETED_KEY);
  safeRemove(FIRST_MOVE_SHOWN_AT_KEY);
  safeRemove(FIRST_MOVE_CATEGORY_KEY);
  safeRemove(FIRST_MOVE_LISTING_KEY);
}
