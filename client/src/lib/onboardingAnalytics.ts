/**
 * Lightweight analytics fan-out for the post-onboarding "Instant Best Move"
 * preference flow. We intentionally avoid coupling to any specific vendor
 * here — the helper fires a browser CustomEvent plus forwards to
 * `window.gtag` / `window.posthog` / `window.analytics` if they happen to
 * be installed. Production wiring can subscribe to the CustomEvent without
 * touching call sites.
 */

export type OnboardingAnalyticsEvent =
  | "onboarding_preferences_started"
  | "onboarding_interest_selected"
  | "onboarding_preferences_submitted"
  | "onboarding_best_move_loaded"
  | "onboarding_best_move_empty"
  | "onboarding_best_move_clicked"
  | "onboarding_best_move_view_clicked"
  | "onboarding_best_move_saved"
  | "onboarding_best_move_skipped"
  | "onboarding_best_move_refined"
  | "onboarding_best_move_reshuffled";

export const ONBOARDING_ANALYTICS_EVENT = "f10:onboarding-analytics";

type AnalyticsProps = Record<string, unknown>;

type WindowWithTrackers = Window & {
  gtag?: (...args: unknown[]) => void;
  posthog?: { capture?: (name: string, props?: AnalyticsProps) => void };
  analytics?: { track?: (name: string, props?: AnalyticsProps) => void };
};

function resolveWindow(): WindowWithTrackers | null {
  if (typeof window === "undefined") return null;
  return window as WindowWithTrackers;
}

export function trackOnboardingEvent(
  event: OnboardingAnalyticsEvent,
  props: AnalyticsProps = {}
): void {
  const win = resolveWindow();
  if (!win) return;

  const payload = { event, ...props, ts: Date.now() };

  try {
    win.dispatchEvent(
      new CustomEvent(ONBOARDING_ANALYTICS_EVENT, { detail: payload })
    );
  } catch {
    /* ignore */
  }

  try {
    win.posthog?.capture?.(event, props);
  } catch {
    /* ignore */
  }
  try {
    win.analytics?.track?.(event, props);
  } catch {
    /* ignore */
  }
  try {
    if (typeof win.gtag === "function") {
      win.gtag("event", event, props);
    }
  } catch {
    /* ignore */
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[onboarding-analytics]", event, props);
  }
}

/** Convenience helpers so call sites stay compact and self-documenting. */
export const onboardingAnalytics = {
  started: (props?: AnalyticsProps) =>
    trackOnboardingEvent("onboarding_preferences_started", props),
  interestSelected: (interest: string, count: number) =>
    trackOnboardingEvent("onboarding_interest_selected", { interest, count }),
  submitted: (interests: string[]) =>
    trackOnboardingEvent("onboarding_preferences_submitted", {
      interests,
      count: interests.length,
    }),
  bestMoveLoaded: (props: AnalyticsProps) =>
    trackOnboardingEvent("onboarding_best_move_loaded", props),
  bestMoveEmpty: (props: AnalyticsProps) =>
    trackOnboardingEvent("onboarding_best_move_empty", props),
  viewClicked: (props: AnalyticsProps) => {
    // Mirror the spec-level event name and the richer internal name so
    // Slice B dashboards and long-term telemetry both resolve.
    trackOnboardingEvent("onboarding_best_move_clicked", props);
    trackOnboardingEvent("onboarding_best_move_view_clicked", props);
  },
  saved: (props: AnalyticsProps) =>
    trackOnboardingEvent("onboarding_best_move_saved", props),
  skipped: (props?: AnalyticsProps) =>
    trackOnboardingEvent("onboarding_best_move_skipped", props),
  refined: (props?: AnalyticsProps) =>
    trackOnboardingEvent("onboarding_best_move_refined", props),
  reshuffled: (props?: AnalyticsProps) =>
    trackOnboardingEvent("onboarding_best_move_reshuffled", props),
};
