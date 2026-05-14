export const ASSISTANT_FEED_EVENT = "f10-assistant-feed";

/** Short-lived deal-optimization toast on the assistant dock */
export const DEAL_COACH_EVENT = "f10-deal-coach";

/**
 * Push a short proactive hint to the side assistant (deduped by `id` in the UI).
 * @param {{ id: string, tone?: 'urgent'|'gem'|'watch'|'promo'|'scan'|'info', title: string, body: string, priority?: number }} payload
 */
export function pushAssistantSignal(payload) {
  if (typeof window === "undefined") return;
  const { id, tone = "info", title, body, priority = 1 } = payload;
  if (!id || !title || !body) return;
  window.dispatchEvent(
    new CustomEvent(ASSISTANT_FEED_EVENT, {
      detail: { id, tone, title, body, priority, ts: Date.now() },
    })
  );
}

function safeJsonArr(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Occasional context-aware nudges when pages aren’t pushing live signals. */
export function buildPassiveHints(pathname, _user) {
  const hints = [];
  const p = pathname || "";

  if (p.startsWith("/auctions")) {
    const wl = safeJsonArr("f10_watchlist_ids");
    if (wl.length === 0) {
      hints.push({
        id: "passive-auctions-save",
        tone: "info",
        title: "Guide",
        body: "Save listings — builds Power + watchlist alerts.",
        priority: 0,
      });
    }
  }

  if (p.startsWith("/feed")) {
    const pr = safeJsonArr("f10_promoted_item_ids");
    if (pr.length < 3) {
      hints.push({
        id: "passive-feed-promote",
        tone: "promo",
        title: "Optimize",
        body: "Promote more — boosts Power + feed visibility.",
        priority: 0,
      });
    }
  }

  if (p.startsWith("/scanner")) {
    hints.push({
      id: "passive-scanner-tip",
      tone: "scan",
      title: "Guide",
      body: "Paste a haul link — we match products to chase.",
      priority: 0,
    });
  }

  if (p.startsWith("/promote-listing") || p.startsWith("/promotion")) {
    hints.push({
      id: "passive-promote-packages",
      tone: "promo",
      title: "Optimize",
      body: "Strong title + image = better promo ROI.",
      priority: 0,
    });
  }

  if (p.startsWith("/profile")) {
    const wl = safeJsonArr("f10_watchlist_ids").length;
    if (wl > 0 && wl < 3) {
      hints.push({
        id: "passive-profile-watchlist",
        tone: "watch",
        title: "Guide",
        body: `${wl}/3 saves — hit 3 for sync + Power.`,
        priority: 0,
      });
    }
  }

  return hints;
}
