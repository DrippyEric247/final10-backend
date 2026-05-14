/**
 * Contextual first-time tab guidance state + analytics.
 *
 * Produces the equivalent of:
 *   user.tutorialSeen = {
 *     quickSnipes: boolean,
 *     promote: boolean,
 *     offers: boolean,
 *     feed: boolean,
 *   }
 *
 * The client persists the snapshot in localStorage so we never blow
 * tutorial cards in someone's face on every page hop. When the user is
 * authenticated the server can later hydrate from this snapshot — this
 * module deliberately doesn't reach into AuthContext to keep the guidance
 * system non-invasive.
 */

export type TutorialKey = "quickSnipes" | "promote" | "offers" | "feed";

export const TUTORIAL_KEYS: ReadonlyArray<TutorialKey> = [
  "quickSnipes",
  "promote",
  "offers",
  "feed",
];

export type TutorialSeenMap = Record<TutorialKey, boolean>;

const SEEN_STORAGE_KEY = "f10_tutorial_seen_v1";
const REWARDED_STORAGE_KEY = "f10_tutorial_rewarded_v1";

const DEFAULT_SEEN: TutorialSeenMap = {
  quickSnipes: false,
  promote: false,
  offers: false,
  feed: false,
};

function readMap(storageKey: string): TutorialSeenMap {
  if (typeof window === "undefined") return { ...DEFAULT_SEEN };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_SEEN };
    const parsed = JSON.parse(raw) as Partial<TutorialSeenMap> | null;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SEEN };
    return {
      quickSnipes: Boolean(parsed.quickSnipes),
      promote: Boolean(parsed.promote),
      offers: Boolean(parsed.offers),
      feed: Boolean(parsed.feed),
    };
  } catch {
    return { ...DEFAULT_SEEN };
  }
}

function writeMap(storageKey: string, map: TutorialSeenMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getTutorialSeen(): TutorialSeenMap {
  return readMap(SEEN_STORAGE_KEY);
}

export function hasSeenTutorial(key: TutorialKey): boolean {
  return Boolean(getTutorialSeen()[key]);
}

export function markTutorialSeen(key: TutorialKey): void {
  const next = { ...getTutorialSeen(), [key]: true };
  writeMap(SEEN_STORAGE_KEY, next);
}

export function resetTutorialSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEEN_STORAGE_KEY);
    window.localStorage.removeItem(REWARDED_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * "Learned this feature" rewards are deliberately one-shot per tab so
 * users can't farm them by clearing localStorage on the SEEN key — the
 * REWARDED key is independent.
 */
export function hasBeenRewarded(key: TutorialKey): boolean {
  return Boolean(readMap(REWARDED_STORAGE_KEY)[key]);
}

export function markRewarded(key: TutorialKey): void {
  const next = { ...readMap(REWARDED_STORAGE_KEY), [key]: true };
  writeMap(REWARDED_STORAGE_KEY, next);
}

/* ---------------- Runtime interaction bus ---------------- */

export const TOUR_EVENT = "f10:tour";
export const TOUR_ACTION_EVENT = "f10:tour:action";
export const TOUR_ANALYTICS_EVENT = "f10:tour:analytics";

export type TourLifecycleEvent =
  | "tour_shown"
  | "tour_dismissed"
  | "tour_primary_clicked"
  | "tour_completed";

/**
 * Emits an analytics-flavored event for downstream listeners. Safely
 * noops server-side; fans out to gtag / posthog / analytics if present
 * (mirrors the onboarding analytics shape).
 */
export function trackTourEvent(
  name: TourLifecycleEvent,
  key: TutorialKey,
  props: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  const payload = { name, key, ...props, ts: Date.now() };

  try {
    window.dispatchEvent(
      new CustomEvent(TOUR_ANALYTICS_EVENT, { detail: payload })
    );
  } catch {
    /* ignore */
  }

  const w = window as Window & {
    gtag?: (...args: unknown[]) => void;
    posthog?: { capture?: (n: string, p?: Record<string, unknown>) => void };
    analytics?: { track?: (n: string, p?: Record<string, unknown>) => void };
  };
  try {
    w.posthog?.capture?.(name, { tutorial: key, ...props });
  } catch {
    /* ignore */
  }
  try {
    w.analytics?.track?.(name, { tutorial: key, ...props });
  } catch {
    /* ignore */
  }
  try {
    w.gtag?.("event", name, { tutorial: key, ...props });
  } catch {
    /* ignore */
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[tour-analytics]", name, key, props);
  }
}

/**
 * Pages call `emitTourAction("quickSnipes")` when the user performs the
 * feature's characteristic action (searching on Quick Snipes, tapping a
 * category chip on Feed, etc.). The overlay listens and awards the
 * "learned this feature" bonus once.
 */
export function emitTourAction(key: TutorialKey, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(TOUR_ACTION_EVENT, { detail: { key, ...props } })
    );
  } catch {
    /* ignore */
  }
}
