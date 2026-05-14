export const SOCIAL_ANALYTICS_EVENT = "f10:social-click";

const SOCIAL_EVENT_BY_ID = {
  instagram: "social_click_instagram",
  facebook: "social_click_facebook",
  x: "social_click_x",
  tiktok: "social_click_tiktok",
};

function safeWindow() {
  if (typeof window === "undefined") return null;
  return window;
}

export function trackSocialClick(platform, extras = {}) {
  const win = safeWindow();
  if (!win) return;
  const event = SOCIAL_EVENT_BY_ID[platform] || `social_click_${String(platform || "unknown")}`;
  const payload = { event, platform, ...extras, ts: Date.now() };

  try {
    win.dispatchEvent(new CustomEvent(SOCIAL_ANALYTICS_EVENT, { detail: payload }));
  } catch {
    /* ignore */
  }
  try {
    win.posthog?.capture?.(event, payload);
  } catch {
    /* ignore */
  }
  try {
    win.analytics?.track?.(event, payload);
  } catch {
    /* ignore */
  }
  try {
    if (typeof win.gtag === "function") {
      win.gtag("event", event, payload);
    }
  } catch {
    /* ignore */
  }
}

