/**
 * Category-specific Best Move fallback queries — never PS5-as-universal.
 */

export const CATEGORY_FALLBACK_QUERIES = Object.freeze({
  gaming: Object.freeze([
    'playstation 5 console',
    'xbox series x console',
    'nintendo switch oled',
    'gaming monitor 27',
    'gaming headset wireless',
  ]),
  auto: Object.freeze([
    'car diagnostic scanner obd2',
    'impact wrench cordless',
    'floor jack 3 ton',
    'bmw scan tool',
    'socket set metric',
  ]),
  home: Object.freeze([
    'gaming desk',
    'office chair ergonomic',
    'air purifier hepa',
    'robot vacuum',
    'smart thermostat',
  ]),
  electronics: Object.freeze([
    'airpods pro',
    'apple ipad',
    '4k monitor',
    'laptop notebook',
    'apple watch',
  ]),
  tech: Object.freeze([
    'airpods pro',
    'apple ipad',
    '4k monitor',
    'laptop notebook',
    'apple watch',
  ]),
  fashion: Object.freeze([
    'air jordan sneakers',
    'nike tech fleece',
    'designer hoodie',
    'mens watch',
    'vintage jacket',
  ]),
  sneakers: Object.freeze([
    'air jordan 1 retro',
    'nike dunk low',
    'adidas yeezy',
    'new balance 550',
    'running sneakers',
  ]),
  luxury: Object.freeze([
    'rolex watch',
    'omega seamaster',
    'designer bag authentic',
    'luxury sunglasses',
    'gold bracelet',
  ]),
  collectibles: Object.freeze([
    'pokemon booster box',
    'graded trading card',
    'sports card lot',
    'funko pop chase',
    'comic book key issue',
  ]),
});

/** Balanced widen queries — one per category, not PS5-first. */
export const BALANCED_WIDEN_QUERIES = Object.freeze([
  { category: 'gaming', query: 'playstation 5 console' },
  { category: 'auto', query: 'car diagnostic scanner obd2' },
  { category: 'home', query: 'office chair ergonomic' },
  { category: 'electronics', query: 'airpods pro' },
  { category: 'fashion', query: 'air jordan sneakers' },
]);

const CATEGORY_ALIASES = Object.freeze({
  'pc-builds': 'gaming',
  'bmw-parts': 'auto',
  'home-tech': 'home',
  audio: 'electronics',
  cameras: 'electronics',
  watches: 'fashion',
});

export function normalizeBestMoveCategory(raw) {
  const c = String(raw || '')
    .toLowerCase()
    .trim();
  if (!c || c === 'all') return '';
  if (c === 'tech') return 'electronics';
  if (CATEGORY_ALIASES[c]) return CATEGORY_ALIASES[c];
  if (CATEGORY_FALLBACK_QUERIES[c]) return c;
  return c;
}

export function inferCategoryFromQuery(query) {
  const q = String(query || '').toLowerCase();
  if (/ps5|xbox|switch|rtx|gaming|nintendo|headset|monitor/.test(q)) return 'gaming';
  if (/bmw|scanner|wrench|jack|socket|obd|automotive|diagnostic/.test(q)) return 'auto';
  if (/desk|chair|purifier|vacuum|thermostat|smart home|furniture/.test(q)) return 'home';
  if (/iphone|ipad|airpods|macbook|laptop|monitor|apple watch|electronics/.test(q)) return 'electronics';
  if (/jordan|nike|sneaker|hoodie|fashion|jacket|watch/.test(q)) return 'fashion';
  if (/pokemon|card|collectible/.test(q)) return 'collectibles';
  if (/rolex|luxury|designer bag/.test(q)) return 'luxury';
  return '';
}

/**
 * Pick next fallback query staying inside the user's category when possible.
 */
export function pickCategoryFallbackQuery(categoryOrQuery, query = '', attemptIndex = 0) {
  const inferred = normalizeBestMoveCategory(categoryOrQuery) || inferCategoryFromQuery(query);
  const category = inferred || 'gaming';
  const pool = CATEGORY_FALLBACK_QUERIES[category] || CATEGORY_FALLBACK_QUERIES.gaming;
  const idx = Math.abs(attemptIndex) % pool.length;
  return {
    query: pool[idx],
    category,
    label: category.charAt(0).toUpperCase() + category.slice(1),
  };
}

export function getCategoryFallbackQueries(category) {
  const cat = normalizeBestMoveCategory(category) || 'gaming';
  return CATEGORY_FALLBACK_QUERIES[cat] || CATEGORY_FALLBACK_QUERIES.gaming;
}

export const NO_PERFECT_MATCH_MESSAGE =
  'No perfect Best Move found yet. Here are the closest strong options.';
