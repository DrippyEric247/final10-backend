/**
 * In-memory TTL cache for Best Buy API responses.
 */

const { getBestBuyConfig } = require('../../config/bestBuyConfig');

const map = new Map();
const lru = [];
const MAX_ENTRIES = 128;

function touch(key) {
  const idx = lru.indexOf(key);
  if (idx >= 0) lru.splice(idx, 1);
  lru.push(key);
  while (lru.length > MAX_ENTRIES) {
    const drop = lru.shift();
    if (drop) map.delete(drop);
  }
}

function getTtl(kind) {
  const cfg = getBestBuyConfig();
  if (kind === 'openbox') return cfg.openBoxCacheTtlMs;
  if (kind === 'product') return cfg.productCacheTtlMs;
  return cfg.searchCacheTtlMs;
}

function remember(key, payload, kind = 'search') {
  if (!key || payload == null) return;
  map.set(key, { savedAt: Date.now(), payload, kind });
  touch(key);
}

function recall(key) {
  if (!key) return { hit: false, payload: null };
  const row = map.get(key);
  if (!row) return { hit: false, payload: null };
  const ttl = getTtl(row.kind);
  if (Date.now() - row.savedAt > ttl) {
    map.delete(key);
    const i = lru.indexOf(key);
    if (i >= 0) lru.splice(i, 1);
    return { hit: false, payload: null, expired: true };
  }
  touch(key);
  return { hit: true, payload: row.payload };
}

function cacheKey(parts) {
  return ['bestbuy', ...parts.map((x) => String(x ?? ''))].join(':');
}

function clearAll() {
  map.clear();
  lru.length = 0;
}

module.exports = {
  remember,
  recall,
  cacheKey,
  clearAll,
};
