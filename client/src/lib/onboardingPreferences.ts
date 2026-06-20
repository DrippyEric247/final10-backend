/**
 * Post-onboarding "Instant Best Move" preference state.
 *
 * Lives in localStorage for anonymous visitors and newly-registered users.
 * Completion and interests are scoped per user id when authenticated; guest
 * traffic uses a separate scope so a prior session on the same device cannot
 * skip onboarding for a newly created account.
 */

import type { AuthUser } from "../context/AuthContext";

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

const GUEST_SCOPE = "guest";

const SELECTED_KEY_BASE = "f10_onboarding_interests_v1";
const COMPLETED_KEY_BASE = "f10_onboarding_completed_v1";
const FIRST_MOVE_SHOWN_AT_KEY_BASE = "f10_first_best_move_shown_at_v1";
const FIRST_MOVE_CATEGORY_KEY_BASE = "f10_first_best_move_category_v1";
const FIRST_MOVE_LISTING_KEY_BASE = "f10_first_best_move_listing_v1";

/** Pre–per-user keys (device-wide). Read for guest checks; cleared on new signup. */
const LEGACY_SELECTED_KEY = SELECTED_KEY_BASE;
const LEGACY_COMPLETED_KEY = COMPLETED_KEY_BASE;
const LEGACY_FIRST_MOVE_SHOWN_AT_KEY = FIRST_MOVE_SHOWN_AT_KEY_BASE;
const LEGACY_FIRST_MOVE_CATEGORY_KEY = FIRST_MOVE_CATEGORY_KEY_BASE;
const LEGACY_FIRST_MOVE_LISTING_KEY = FIRST_MOVE_LISTING_KEY_BASE;

function onboardingScope(userId?: string | null): string {
  if (userId) return String(userId);
  return GUEST_SCOPE;
}

/** Normalize auth user id from AuthContext for scoped localStorage keys. */
export function onboardingUserId(user?: AuthUser | null): string | undefined {
  if (!user) return undefined;
  const id = user.id ?? user._id;
  if (id == null || id === "") return undefined;
  return String(id);
}

function scopedKey(base: string, userId?: string | null): string {
  return `${base}_${onboardingScope(userId)}`;
}

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

function parseInterestList(raw: string | null): InterestId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed
      .map((v) => String(v || "").toLowerCase())
      .filter((v): v is InterestId => VALID_INTERESTS.has(v as InterestId));
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

export function getSelectedInterests(userId?: string | null): InterestId[] {
  const scoped = parseInterestList(safeGet(scopedKey(SELECTED_KEY_BASE, userId)));
  if (scoped.length > 0) return scoped;
  if (userId) return [];
  return parseInterestList(safeGet(LEGACY_SELECTED_KEY));
}

export function setSelectedInterests(
  interests: InterestId[],
  userId?: string | null
): void {
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
  safeSet(scopedKey(SELECTED_KEY_BASE, userId), JSON.stringify(out));
}

export function clearSelectedInterests(userId?: string | null): void {
  safeRemove(scopedKey(SELECTED_KEY_BASE, userId));
  if (!userId) safeRemove(LEGACY_SELECTED_KEY);
}

export function hasCompletedOnboarding(userId?: string | null): boolean {
  if (userId) {
    return safeGet(scopedKey(COMPLETED_KEY_BASE, userId)) === "1";
  }
  if (safeGet(scopedKey(COMPLETED_KEY_BASE, null)) === "1") return true;
  return safeGet(LEGACY_COMPLETED_KEY) === "1";
}

export function markOnboardingCompleted(userId?: string | null): void {
  const key = scopedKey(COMPLETED_KEY_BASE, userId);
  const wasComplete = safeGet(key) === "1";
  safeSet(key, "1");
  if (!wasComplete && typeof window !== "undefined") {
    import("./analytics")
      .then((m) => {
        m.trackEvent("onboarding_completed", {});
        m.trackEvent("onboarding_complete", {});
      })
      .catch(() => {});
    import("./auditLog")
      .then((m) => {
        m.auditOnboarding({
          action: "completed",
          userId: userId || "guest",
          scopedKey: key,
        });
      })
      .catch(() => {});
  }
}

export function resetOnboardingCompleted(userId?: string | null): void {
  safeRemove(scopedKey(COMPLETED_KEY_BASE, userId));
  if (!userId) safeRemove(LEGACY_COMPLETED_KEY);
}

export type FirstBestMoveSnapshot = {
  shownAt: number | null;
  category: InterestId | null;
  listingId: string | null;
};

export function recordFirstBestMove(
  category: InterestId | null,
  listingId: string | null,
  userId?: string | null
): FirstBestMoveSnapshot {
  const shownAt = Date.now();
  safeSet(scopedKey(FIRST_MOVE_SHOWN_AT_KEY_BASE, userId), String(shownAt));
  if (category) {
    safeSet(scopedKey(FIRST_MOVE_CATEGORY_KEY_BASE, userId), category);
  } else {
    safeRemove(scopedKey(FIRST_MOVE_CATEGORY_KEY_BASE, userId));
  }
  if (listingId) {
    safeSet(scopedKey(FIRST_MOVE_LISTING_KEY_BASE, userId), listingId);
  } else {
    safeRemove(scopedKey(FIRST_MOVE_LISTING_KEY_BASE, userId));
  }
  return { shownAt, category, listingId };
}

export function getFirstBestMoveSnapshot(
  userId?: string | null
): FirstBestMoveSnapshot {
  const shownAtRaw =
    safeGet(scopedKey(FIRST_MOVE_SHOWN_AT_KEY_BASE, userId)) ||
    (!userId ? safeGet(LEGACY_FIRST_MOVE_SHOWN_AT_KEY) : null);
  const shownAt = shownAtRaw ? Number(shownAtRaw) : null;
  const category = (safeGet(scopedKey(FIRST_MOVE_CATEGORY_KEY_BASE, userId)) ||
    (!userId ? safeGet(LEGACY_FIRST_MOVE_CATEGORY_KEY) : null) ||
    null) as InterestId | null;
  const listingId =
    safeGet(scopedKey(FIRST_MOVE_LISTING_KEY_BASE, userId)) ||
    (!userId ? safeGet(LEGACY_FIRST_MOVE_LISTING_KEY) : null) ||
    null;
  return {
    shownAt: Number.isFinite(shownAt as number) ? (shownAt as number) : null,
    category: category && VALID_INTERESTS.has(category) ? category : null,
    listingId,
  };
}

function clearScopedOnboardingKeys(scope: string): void {
  safeRemove(`${SELECTED_KEY_BASE}_${scope}`);
  safeRemove(`${COMPLETED_KEY_BASE}_${scope}`);
  safeRemove(`${FIRST_MOVE_SHOWN_AT_KEY_BASE}_${scope}`);
  safeRemove(`${FIRST_MOVE_CATEGORY_KEY_BASE}_${scope}`);
  safeRemove(`${FIRST_MOVE_LISTING_KEY_BASE}_${scope}`);
}

function clearLegacyOnboardingKeys(): void {
  safeRemove(LEGACY_SELECTED_KEY);
  safeRemove(LEGACY_COMPLETED_KEY);
  safeRemove(LEGACY_FIRST_MOVE_SHOWN_AT_KEY);
  safeRemove(LEGACY_FIRST_MOVE_CATEGORY_KEY);
  safeRemove(LEGACY_FIRST_MOVE_LISTING_KEY);
}

/** Clear guest + legacy device-wide onboarding state (anonymous previews). */
export function clearGuestOnboardingState(): void {
  clearScopedOnboardingKeys(GUEST_SCOPE);
  clearLegacyOnboardingKeys();
}

/** Reset onboarding for one user, or guest/legacy when userId is omitted. */
export function resetOnboardingPreferences(userId?: string | null): void {
  if (userId) {
    clearScopedOnboardingKeys(String(userId));
    return;
  }
  clearGuestOnboardingState();
}

/** Fresh account: wipe guest residue and any stale per-user keys before onboarding. */
export function resetOnboardingForNewAccount(userId: string | null | undefined): void {
  clearGuestOnboardingState();
  if (userId) clearScopedOnboardingKeys(String(userId));
}
