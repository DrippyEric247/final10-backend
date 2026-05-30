import { buildApiUrl } from "./runtimeApi";

/**
 * Product analytics — fans out to GA4 (optional), PostHog/Segment-style globals,
 * and Final10 `/api/analytics/event` for structured server logs.
 */

/** Canonical client event names for dashboards / warehouse contracts. */
export const ANALYTICS_EVENTS = Object.freeze({
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",
  QUICK_SNIPE_SEARCH: "quick_snipe_search",
  ALERT_CREATED: "alert_created",
  SCANNER_USED: "scanner_used",
  ITEM_SAVED: "item_saved",
  POINTS_EARNED: "points_earned",
  UPGRADE_CLICKED: "upgrade_clicked",
  DEMO_STARTED: "demo_started",
  DEMO_COMPLETED: "demo_completed",
  BETA_TESTER_ACTION: "beta_tester_action",
});

const ANON_KEY = "f10_telemetry_anon_v1";
const SESSION_KEY = "f10_telemetry_session_v1";

function backendEnabled() {
  if (typeof process !== "undefined" && process.env.REACT_APP_ANALYTICS_BACKEND === "false") return false;
  return true;
}

function gaMeasurementId() {
  return (typeof process !== "undefined" && process.env.REACT_APP_GA_MEASUREMENT_ID) || "";
}

export function getTelemetryAnonId() {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function getTelemetrySessionId() {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function authHeaders() {
  try {
    const t = window.localStorage.getItem("f10_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function fanOutThirdParty(name, props) {
  if (typeof window === "undefined") return;
  const w = window;
  try {
    w.posthog?.capture?.(name, props);
  } catch {
    /* ignore */
  }
  try {
    w.analytics?.track?.(name, props);
  } catch {
    /* ignore */
  }
  try {
    if (typeof w.gtag === "function") {
      w.gtag("event", name, props);
    }
  } catch {
    /* ignore */
  }
}

function sendToBackend(name, props) {
  if (!backendEnabled() || typeof window === "undefined") return;
  const url = buildApiUrl("/analytics/event");
  if (!url) return;
  const body = JSON.stringify({
    name,
    props,
    anonId: getTelemetryAnonId(),
    sessionId: getTelemetrySessionId(),
  });
  try {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} [props]
 */
export function trackEvent(name, props = {}) {
  if (typeof window === "undefined" || !name) return;
  const safe = { ...props, ts: Date.now(), path: window.location?.pathname || "" };
  fanOutThirdParty(name, safe);
  sendToBackend(name, safe);

  try {
    window.dispatchEvent(new CustomEvent("f10:analytics", { detail: { name, props: safe } }));
  } catch {
    /* ignore */
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", name, safe);
  }
}

/**
 * @param {number} amount
 * @param {string} source
 * @param {Record<string, unknown>} [extra]
 */
export function trackPointsEarned(amount, source, extra = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return;
  trackEvent(ANALYTICS_EVENTS.POINTS_EARNED, {
    amount: Math.round(n * 100) / 100,
    source,
    ...extra,
  });
}

/**
 * @param {string} action
 * @param {Record<string, unknown>} [extra]
 */
export function trackQuickSnipeAction(action, extra = {}) {
  trackEvent("quick_snipe_action", { action, ...extra });
}

/** User ran a Quick Snipes hunt query (distinct from generic `quick_snipe_action`). */
export function trackQuickSnipeSearch(extra = {}) {
  trackEvent(ANALYTICS_EVENTS.QUICK_SNIPE_SEARCH, extra);
}

export function trackUpgradeClicked(source, extra = {}) {
  if (!source) return;
  trackEvent(ANALYTICS_EVENTS.UPGRADE_CLICKED, { source, ...extra });
}

/** Log beta tester feature usage (persisted server-side for founding testers). */
export function trackBetaTesterUsage(action, extra = {}) {
  if (!action) return;
  trackEvent(`beta_tester_${String(action).slice(0, 64)}`, {
    action,
    ...extra,
  });
}

/** Load gtag.js when REACT_APP_GA_MEASUREMENT_ID is set. Call once from App mount. */
export function initThirdPartyAnalytics() {
  if (typeof window === "undefined") return;
  const mid = gaMeasurementId();
  if (!mid || window.__f10GtagLoaded) return;
  window.__f10GtagLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", mid, { send_page_view: false });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(mid)}`;
  document.head.appendChild(s);
}
