const STORAGE_KEY = "f10_listing_intent_v1";

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function row(state, id) {
  const k = String(id);
  if (!state[k]) state[k] = { dwellMs: 0, lastExit: 0, lastEnter: 0, returnVisits: 0 };
  return state[k];
}

/**
 * Call when listing crosses into view (meaningful visibility).
 */
export function onListingBecameVisible(id) {
  const state = load();
  const r = row(state, id);
  const now = Date.now();
  if (r.lastExit && now - r.lastExit > 2600) {
    r.returnVisits = (r.returnVisits || 0) + 1;
  }
  r.lastEnter = now;
  save(state);
}

export function onListingLeftView(id) {
  const state = load();
  const r = row(state, id);
  r.lastExit = Date.now();
  save(state);
}

export function addListingDwell(id, ms) {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return;
  }
  const state = load();
  const r = row(state, id);
  r.dwellMs = (r.dwellMs || 0) + ms;
  save(state);
}

export function getListingSnapshot(id) {
  const r = row(load(), id);
  return {
    dwellMs: r.dwellMs || 0,
    returnVisits: r.returnVisits || 0,
  };
}
