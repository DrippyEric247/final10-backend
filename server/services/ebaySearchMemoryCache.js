/**
 * Short-lived in-memory cache of last successful eBay search payloads per route.
 * Stores slim listing rows only — never full normalized + legacy duplicates.
 */

const { slimListingList } = require('../lib/ebayBetaLimits');

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 16;

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
  if (!key || !payload) return;
  const slim = { ...payload };
  if (Array.isArray(slim.items)) slim.items = slimListingList(slim.items);
  if (Array.isArray(slim.normalizedItems)) {
    slim.normalizedItems = slim.items;
  }
  if (Array.isArray(slim.final10)) slim.final10 = slimListingList(slim.final10);
  map.set(key, { savedAt: Date.now(), payload: slim });
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
