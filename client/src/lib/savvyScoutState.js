/** Scout mascot visual state events (skin for existing assistant). */
export const SCOUT_STATE_EVENT = "f10-scout-state";
export const SCOUT_DEAL_FOUND_EVENT = "f10-scout-deal-found";

/**
 * Broadcast scout animation state to the dock button.
 * @param {"idle"|"searching"|"dealFound"|"excited"} state
 */
export function setScoutVisualState(state) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SCOUT_STATE_EVENT, { detail: { state, ts: Date.now() } })
  );
}

/**
 * Push a deal-found toast for Savvy Scout (optional url for View Deal).
 * @param {{ title?: string, body?: string, url?: string, id?: string }} payload
 */
export function pushScoutDealFound(payload = {}) {
  if (typeof window === "undefined") return;
  const { title, body, url, id } = payload;
  window.dispatchEvent(
    new CustomEvent(SCOUT_DEAL_FOUND_EVENT, {
      detail: {
        id: id || `scout-deal-${Date.now()}`,
        title: title || "Deal found!",
        body: body || "I found something worth checking.",
        url: url || "",
        ts: Date.now(),
      },
    })
  );
}

/** True when an assistant feed row should trigger the deal-found celebration. */
export function isDealFoundFeedRow(detail) {
  if (!detail) return false;
  const tone = String(detail.tone || "").toLowerCase();
  const priority = Number(detail.priority) || 0;
  return (
    detail.dealFound === true ||
    tone === "urgent" ||
    tone === "gem" ||
    priority >= 2
  );
}
