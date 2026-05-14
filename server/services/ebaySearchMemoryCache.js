/**
 * Short-lived in-memory cache of last successful eBay search payloads per route.
 * Used only when live Browse calls fail — returns stale results instead of an empty screen.
 */

const TTL_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 48;

const map = new Map();
/** @type {string[]} */
const lru = [];

function touch(key) {
  const idx = lru.indexOf(key);
  if (idx >= 0) lru.splice(idx, 1);
  lru.push(key);
  while (lru.length > MAX_ENTRIES) {
    const drop = lru.shift();
    if (drop) map.delete(drop);
  }
}

/**
 * @param {string} key
 * @param {object} payload — JSON-serializable subset of route response
 */
function remember(key, payload) {
  if (!key) return;
  map.set(key, { savedAt: Date.now(), payload });
  touch(key);
}

/**
 * @param {string} key
 * @returns {object|null}
 */
function recall(key) {
  if (!key) return null;
  const row = map.get(key);
  if (!row) return null;
  if (Date.now() - row.savedAt > TTL_MS) {
    map.delete(key);
    const i = lru.indexOf(key);
    if (i >= 0) lru.splice(i, 1);
    return null;
  }
  touch(key);
  return row.payload;
}

function searchKey(parts) {
  return ['ebay', 'search', ...parts.map((x) => String(x ?? ''))].join(':');
}

function final10Key(parts) {
  return ['ebay', 'final10', ...parts.map((x) => String(x ?? ''))].join(':');
}

module.exports = {
  remember,
  recall,
  searchKey,
  final10Key,
};
