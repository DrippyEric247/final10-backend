const STORAGE_PREFIX = 'f10_owner_search_history_';
const MAX_ENTRIES = 20;

function storageKey(ownerUserId) {
  return `${STORAGE_PREFIX}${String(ownerUserId || 'anonymous')}`;
}

export function loadOwnerSearchHistory(ownerUserId) {
  if (typeof window === 'undefined' || !ownerUserId) return [];
  try {
    const raw = localStorage.getItem(storageKey(ownerUserId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} ownerUserId
 * @param {{ query: string, resultCount: number, users?: object[] }} entry
 */
export function saveOwnerSearchHistory(ownerUserId, entry) {
  if (typeof window === 'undefined' || !ownerUserId || !entry?.query) return [];
  const query = String(entry.query).trim();
  if (!query) return loadOwnerSearchHistory(ownerUserId);

  const prev = loadOwnerSearchHistory(ownerUserId).filter(
    (row) => String(row.query).toLowerCase() !== query.toLowerCase()
  );
  const next = [
    {
      query,
      resultCount: Number(entry.resultCount) || 0,
      searchedAt: new Date().toISOString(),
      users: Array.isArray(entry.users) ? entry.users.slice(0, 10) : [],
    },
    ...prev,
  ].slice(0, MAX_ENTRIES);

  try {
    localStorage.setItem(storageKey(ownerUserId), JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function clearOwnerSearchHistory(ownerUserId) {
  if (typeof window === 'undefined' || !ownerUserId) return;
  try {
    localStorage.removeItem(storageKey(ownerUserId));
  } catch {
    /* ignore */
  }
}
