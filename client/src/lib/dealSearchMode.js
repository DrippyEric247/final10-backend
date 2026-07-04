const STORAGE_KEY = 'f10_deal_command_search_mode_v1';
export const DEAL_SEARCH_MODES = ['best_move', 'auction', 'buy_now'];

export function readPersistedSearchMode() {
  if (typeof window === 'undefined') return 'best_move';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (DEAL_SEARCH_MODES.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return 'best_move';
}

export function writePersistedSearchMode(mode) {
  if (typeof window === 'undefined') return;
  if (!DEAL_SEARCH_MODES.includes(mode)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function listingModeForSearchMode(mode) {
  if (mode === 'auction' || mode === 'buy_now') return mode;
  return 'mixed';
}
