/**
 * Savvy Camo Locker — server mirror of the universal catalog.
 *
 * SOURCE OF TRUTH: `packages/savvy-core/src/config/camoLocker.js`
 * This CommonJS mirror exists because the server cannot import the ESM package.
 * Item IDs, thresholds and gates MUST stay identical — `npm run verify` inside
 * `packages/savvy-core` asserts parity on every ID and threshold.
 */

const CAMO_CATALOG_VERSION = 15;
const CAMO_ID_PREFIX = 'camo';

const CAMO_RARITY_RANKS = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 6,
});

/** Ladder order matters — index+1 is the camo `order`. */
const CAMOS = Object.freeze([
  Object.freeze({ id: 'woodland', name: 'Woodland', rarity: 'common', order: 1, threshold: 10 }),
  Object.freeze({ id: 'tiger', name: 'Tiger', rarity: 'uncommon', order: 2, threshold: 75 }),
  Object.freeze({ id: 'arctic', name: 'Arctic', rarity: 'rare', order: 3, threshold: 150 }),
  Object.freeze({ id: 'gold', name: 'Gold', rarity: 'epic', order: 4, threshold: 250 }),
  Object.freeze({ id: 'diamond', name: 'Diamond', rarity: 'legendary', order: 5, threshold: 350 }),
  Object.freeze({
    id: 'darkNebula',
    name: 'Dark Nebula',
    rarity: 'mythic',
    order: 6,
    threshold: 500,
  }),
  Object.freeze({
    id: 'nukeStreak',
    name: 'Nuke Streak',
    rarity: 'mythic',
    order: 7,
    threshold: 999999,
    visibility: 'admin_owner',
    grantOnly: true,
  }),
]);

/** Categories that currently award rewards, bound to one apparel type each. */
const CAMO_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'retail',
    name: 'Retail',
    rewardType: 'tshirt',
    rewardTypes: ['tshirt', 'hoodie'],
    rewardTypeCamoIds: Object.freeze({
      tshirt: ['woodland', 'tiger', 'arctic', 'gold', 'diamond', 'darkNebula', 'nukeStreak'],
      hoodie: ['nukeStreak'],
    }),
    camoIds: ['woodland', 'tiger', 'arctic', 'gold', 'diamond', 'darkNebula', 'nukeStreak'],
  }),
  Object.freeze({ id: 'outdoor', name: 'Outdoor', rewardType: 'hoodie' }),
  Object.freeze({
    id: 'fitness',
    name: 'Fitness',
    rewardType: 'shorts',
    camoIds: ['woodland', 'tiger', 'arctic', 'gold', 'diamond', 'darkNebula', 'nukeStreak'],
  }),
  Object.freeze({
    id: 'automotive',
    name: 'Automotive',
    rewardType: 'gloves',
    camoIds: ['woodland', 'tiger', 'arctic', 'gold', 'diamond', 'darkNebula', 'nukeStreak'],
  }),
  Object.freeze({
    id: 'electronics',
    name: 'Electronics',
    rewardType: 'socks',
    camoIds: ['woodland', 'tiger', 'arctic', 'gold', 'diamond', 'darkNebula', 'nukeStreak'],
  }),
  Object.freeze({
    id: 'luxury',
    name: 'Luxury',
    rewardType: 'shiesty',
    camoIds: ['woodland', 'tiger', 'arctic', 'gold', 'diamond', 'darkNebula', 'nukeStreak'],
  }),
]);

const CAMO_CATEGORY_IDS = Object.freeze(CAMO_CATEGORIES.map((c) => c.id));

/** Secondary gates resolved from real account metrics only. */
const CAMO_GATES = Object.freeze({
  woodland: Object.freeze([]),
  tiger: Object.freeze([{ metric: 'profileLevel', min: 5, label: 'Reach Profile Level 5' }]),
  arctic: Object.freeze([
    { metric: 'profileLevel', min: 10, label: 'Reach Profile Level 10' },
    { metric: 'currentStreak', min: 3, label: 'Hold a 3-day streak' },
  ]),
  gold: Object.freeze([
    { metric: 'profileLevel', min: 20, label: 'Reach Profile Level 20' },
    { metric: 'currentStreak', min: 7, label: 'Hold a 7-day streak' },
  ]),
  diamond: Object.freeze([
    { metric: 'profileLevel', min: 30, label: 'Reach Profile Level 30' },
    { metric: 'battlePassTier', min: 25, label: 'Reach Battle Pass Tier 25' },
  ]),
  darkNebula: Object.freeze([
    { metric: 'profileLevel', min: 45, label: 'Reach Profile Level 45' },
    { metric: 'battlePassTier', min: 50, label: 'Reach Battle Pass Tier 50' },
    { metric: 'currentStreak', min: 14, label: 'Hold a 14-day streak' },
  ]),
  nukeStreak: Object.freeze([]),
});

function slug(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** `camo_fitness_dark-nebula_shorts` */
function buildCamoItemId(categoryId, camoId, rewardTypeId) {
  return [CAMO_ID_PREFIX, slug(categoryId), slug(camoId), slug(rewardTypeId)].join('_');
}

function isCamoItemId(id) {
  return typeof id === 'string' && id.startsWith(`${CAMO_ID_PREFIX}_`);
}

function getCategoryRewardTypes(category) {
  if (category?.rewardTypes?.length) return category.rewardTypes;
  if (category?.rewardType) return [category.rewardType];
  return [];
}

function getCategoryCamos(category, rewardType) {
  const typeIds =
    (rewardType && category?.rewardTypeCamoIds?.[rewardType]) || category?.camoIds;
  if (typeIds?.length) {
    const allowed = new Set(typeIds);
    return CAMOS.filter((c) => allowed.has(c.id));
  }
  return CAMOS.filter((c) => c.visibility !== 'admin_owner');
}

const CAMO_ITEMS = Object.freeze(
  CAMO_CATEGORIES.flatMap((category) =>
    getCategoryRewardTypes(category).flatMap((rewardType) =>
      getCategoryCamos(category, rewardType).map((camo) =>
        Object.freeze({
          id: buildCamoItemId(category.id, camo.id, rewardType),
          camo: camo.id,
          category: category.id,
          rewardType,
          rarity: camo.rarity,
          rarityRank: CAMO_RARITY_RANKS[camo.rarity] || 1,
          order: camo.order,
          threshold: camo.threshold,
          gates: CAMO_GATES[camo.id] || Object.freeze([]),
          visibility: camo.visibility || 'public',
          grantOnly: Boolean(camo.grantOnly),
        })
      )
    )
  )
);

const CAMO_ITEMS_BY_ID = Object.freeze(
  CAMO_ITEMS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {})
);

const CAMO_ITEM_IDS = Object.freeze(CAMO_ITEMS.map((i) => i.id));
const CAMO_ITEM_ID_SET = new Set(CAMO_ITEM_IDS);

function getCamoItem(itemId) {
  return CAMO_ITEMS_BY_ID[itemId] || null;
}

function isKnownCamoItemId(itemId) {
  return CAMO_ITEM_ID_SET.has(itemId);
}

function isValidCamoCategory(categoryId) {
  return CAMO_CATEGORY_IDS.includes(categoryId);
}

function toPercent(current, target) {
  const t = Number(target) || 0;
  if (t <= 0) return 100;
  const c = Math.max(0, Number(current) || 0);
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
}

/**
 * Authoritative requirement evaluation.
 * @param {object} item catalog item
 * @param {{categoryCount?: number, metrics?: Record<string, number>}} ctx
 */
function evaluateCamoRequirement(item, ctx = {}) {
  const target = item?.threshold || 0;
  const raw = Math.max(0, Number(ctx.categoryCount) || 0);
  const metrics = ctx.metrics || {};
  const gateStatus = (item?.gates || []).map((gate) => {
    const value = Math.max(0, Number(metrics[gate.metric]) || 0);
    return { label: gate.label, met: value >= gate.min, current: value, min: gate.min };
  });
  const gatesMet = gateStatus.every((g) => g.met);
  return {
    current: Math.min(raw, target),
    target,
    progress: toPercent(raw, target),
    gatesMet,
    gateStatus,
    requirementsMet: raw >= target && gatesMet,
  };
}

module.exports = {
  CAMO_CATALOG_VERSION,
  CAMO_ID_PREFIX,
  CAMO_RARITY_RANKS,
  CAMOS,
  CAMO_CATEGORIES,
  CAMO_CATEGORY_IDS,
  CAMO_GATES,
  CAMO_ITEMS,
  CAMO_ITEM_IDS,
  buildCamoItemId,
  isCamoItemId,
  isKnownCamoItemId,
  isValidCamoCategory,
  getCamoItem,
  evaluateCamoRequirement,
  toPercent,
};
