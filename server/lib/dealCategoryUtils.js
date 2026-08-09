/**
 * Map feed/listing categories to Camo Locker category IDs for Nuke challenges.
 */

const { listNukeCategoryChallengeCategories } = require('../config/nukeCategoryChallenges');

const NUKE_CATEGORIES = new Set(listNukeCategoryChallengeCategories());

/** Aliases from listings, search, and Best Move → camo category id. */
const CATEGORY_ALIASES = Object.freeze({
  automotive: 'automotive',
  auto: 'automotive',
  cars: 'automotive',
  car: 'automotive',
  electronics: 'electronics',
  electronic: 'electronics',
  tech: 'electronics',
  technology: 'electronics',
  fitness: 'fitness',
  gym: 'fitness',
  workout: 'fitness',
  luxury: 'luxury',
  retail: 'retail',
  fashion: 'retail',
  sneakers: 'retail',
  shoes: 'retail',
  clothing: 'retail',
  home: 'retail',
  gaming: 'retail',
  collectibles: 'retail',
  outdoor: 'outdoor',
  camping: 'outdoor',
  hiking: 'outdoor',
});

function normalizeRawCategory(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolve a listing/auction category to a Nuke-eligible camo category id.
 * @returns {string|null}
 */
function resolveDealCategory(raw) {
  const key = normalizeRawCategory(raw);
  if (!key) return null;

  if (NUKE_CATEGORIES.has(key)) return key;

  const aliased = CATEGORY_ALIASES[key];
  if (aliased && NUKE_CATEGORIES.has(aliased)) return aliased;

  for (const [alias, target] of Object.entries(CATEGORY_ALIASES)) {
    if (key.includes(alias) && NUKE_CATEGORIES.has(target)) return target;
  }

  return null;
}

module.exports = {
  resolveDealCategory,
  normalizeRawCategory,
  NUKE_CATEGORIES,
};
