/**
 * Savvy Camo Locker — universal reward catalog for the whole Savvy Universe.
 *
 * This module is intentionally pure data + pure functions: no React, no DOM, no
 * network. Final10, SavvyTrip, Ai-Go, VR clients and the server all derive the
 * same item IDs and unlock thresholds from here, so one account sees one locker
 * everywhere.
 *
 * Server parity mirror: `server/config/camoLocker.js` (CommonJS). Keep both in
 * sync — `CAMO_CATALOG_VERSION` must be bumped together.
 *
 * @module @savvy/core/config/camoLocker
 */

/** Bump when items/thresholds change so clients can bust caches. */
export const CAMO_CATALOG_VERSION = 7;

/** Prefix for every camo cosmetic ID persisted in the shared cosmetic inventory. */
export const CAMO_ID_PREFIX = 'camo';

/* ------------------------------------------------------------------ *
 * Rarity
 * ------------------------------------------------------------------ */

export const CAMO_RARITIES = Object.freeze({
  common: { id: 'common', label: 'Common', rank: 1, glow: 'rgba(148, 163, 184, 0.45)' },
  uncommon: { id: 'uncommon', label: 'Uncommon', rank: 2, glow: 'rgba(34, 197, 94, 0.45)' },
  rare: { id: 'rare', label: 'Rare', rank: 3, glow: 'rgba(56, 189, 248, 0.5)' },
  epic: { id: 'epic', label: 'Epic', rank: 4, glow: 'rgba(251, 191, 36, 0.5)' },
  legendary: { id: 'legendary', label: 'Legendary', rank: 5, glow: 'rgba(226, 232, 240, 0.55)' },
  mythic: { id: 'mythic', label: 'Mythic', rank: 6, glow: 'rgba(168, 85, 247, 0.6)' },
});

/* ------------------------------------------------------------------ *
 * Camos (the "skins"). Order here IS the progression ladder.
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} CamoTier
 * @property {string} id            slug used in item IDs + asset paths
 * @property {string} name          display name
 * @property {string} collectionName e.g. "Woodland Collection"
 * @property {string} rarity        key of CAMO_RARITIES
 * @property {number} order         1-based ladder position
 * @property {string} accentColor   primary accent
 * @property {string} accentColorAlt secondary accent for gradients
 * @property {number} threshold     category actions required to unlock
 * @property {string} tagline       short flavour line
 */

/** @type {readonly CamoTier[]} */
export const CAMOS = Object.freeze([
  Object.freeze({
    id: 'woodland',
    name: 'Woodland',
    collectionName: 'Woodland Collection',
    rarity: 'common',
    order: 1,
    accentColor: '#6b8f3f',
    accentColorAlt: '#3f5622',
    threshold: 10,
    tagline: 'Where every Operator starts. Classic, quiet, dependable.',
  }),
  Object.freeze({
    id: 'tiger',
    name: 'Tiger',
    collectionName: 'Tiger Collection',
    rarity: 'uncommon',
    order: 2,
    accentColor: '#ff7a00',
    accentColorAlt: '#1a1a1a',
    threshold: 75,
    tagline: 'Built for performance. Designed for Operators.',
  }),
  Object.freeze({
    id: 'arctic',
    name: 'Arctic',
    collectionName: 'Arctic Collection',
    rarity: 'rare',
    order: 3,
    accentColor: '#8fd8ff',
    accentColorAlt: '#f8fafc',
    threshold: 150,
    tagline: 'Cold focus. Clean lines. Zero noise.',
  }),
  Object.freeze({
    id: 'gold',
    name: 'Gold',
    collectionName: 'Gold Collection',
    rarity: 'epic',
    order: 4,
    accentColor: '#ffd166',
    accentColorAlt: '#a97117',
    threshold: 250,
    tagline: 'Earned in the margins. Worn out front.',
  }),
  Object.freeze({
    id: 'diamond',
    name: 'Diamond',
    collectionName: 'Diamond Collection',
    rarity: 'legendary',
    order: 5,
    accentColor: '#dbeafe',
    accentColorAlt: '#7dd3fc',
    threshold: 350,
    tagline: 'Pressure makes it. Patience keeps it.',
  }),
  Object.freeze({
    id: 'darkNebula',
    name: 'Dark Nebula',
    collectionName: 'Dark Nebula Collection',
    rarity: 'mythic',
    order: 6,
    accentColor: '#a855f7',
    accentColorAlt: '#4c1d95',
    threshold: 500,
    tagline: 'The far end of the ladder. Almost nobody gets here.',
  }),
]);

/* ------------------------------------------------------------------ *
 * Apparel / accessory types (reward types)
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} ApparelType
 * @property {string} id
 * @property {string} name      singular
 * @property {string} plural    display label on cards
 * @property {string} assetSlug folder segment for image paths
 * @property {boolean} [comingSoon]
 */

/** @type {readonly ApparelType[]} */
export const APPAREL_TYPES = Object.freeze([
  Object.freeze({ id: 'tshirt', name: 'T-Shirt', plural: 'T-Shirts', assetSlug: 'tshirts' }),
  Object.freeze({ id: 'hoodie', name: 'Hoodie', plural: 'Hoodies', assetSlug: 'hoodies' }),
  Object.freeze({ id: 'shorts', name: 'Shorts', plural: 'Shorts', assetSlug: 'shorts' }),
  Object.freeze({ id: 'gloves', name: 'Gloves', plural: 'Gloves', assetSlug: 'gloves' }),
  Object.freeze({ id: 'socks', name: 'Socks', plural: 'Socks', assetSlug: 'socks' }),
  Object.freeze({ id: 'shiesty', name: 'Shiesty', plural: 'Shiesties', assetSlug: 'shiesties' }),
  // Future reward types — flip `comingSoon` off once art + a category exist.
  Object.freeze({ id: 'hat', name: 'Hat', plural: 'Hats', assetSlug: 'hats', comingSoon: true }),
  Object.freeze({ id: 'mask', name: 'Mask', plural: 'Masks', assetSlug: 'masks', comingSoon: true }),
  Object.freeze({ id: 'flag', name: 'Flag', plural: 'Flags', assetSlug: 'flags', comingSoon: true }),
  Object.freeze({
    id: 'backpack',
    name: 'Backpack',
    plural: 'Backpacks',
    assetSlug: 'backpacks',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'controllerShell',
    name: 'Controller Shell',
    plural: 'Controller Shells',
    assetSlug: 'controller-shells',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'mousepad',
    name: 'Mousepad',
    plural: 'Mousepads',
    assetSlug: 'mousepads',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'keycaps',
    name: 'Keycap Set',
    plural: 'Keycaps',
    assetSlug: 'keycaps',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'travelBag',
    name: 'Travel Bag',
    plural: 'Travel Bags',
    assetSlug: 'travel-bags',
    comingSoon: true,
  }),
]);

/* ------------------------------------------------------------------ *
 * Categories. `rewardType` binds a category to one apparel type.
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} CamoCategory
 * @property {string} id
 * @property {string} name
 * @property {string} rewardType  ApparelType id (null when comingSoon)
 * @property {string} icon        emoji fallback when no art is present
 * @property {string} accentColor
 * @property {string} blurb
 * @property {string} activityLabel what the requirement counter measures
 * @property {boolean} [comingSoon]
 * @property {ReadonlyArray<string>} [camoIds] optional subset of CAMOS for partial ladders
 */

/** @type {readonly CamoCategory[]} */
export const CAMO_CATEGORIES = Object.freeze([
  Object.freeze({
    id: 'retail',
    name: 'Retail',
    rewardType: 'tshirt',
    icon: '🛍️',
    accentColor: '#a855f7',
    blurb: 'Everyday hauls, price drops, and clearance sweeps.',
    activityLabel: 'Retail Deals',
  }),
  Object.freeze({
    id: 'outdoor',
    name: 'Outdoor',
    rewardType: 'hoodie',
    icon: '🏕️',
    accentColor: '#34d399',
    blurb: 'Camping, hiking, and cold-weather gear finds.',
    activityLabel: 'Outdoor Deals',
  }),
  Object.freeze({
    id: 'fitness',
    name: 'Fitness',
    rewardType: 'shorts',
    icon: '💪',
    accentColor: '#f97316',
    blurb: 'Training gear, recovery tech, and gym essentials.',
    activityLabel: 'Fitness Deals',
  }),
  Object.freeze({
    id: 'automotive',
    name: 'Automotive',
    rewardType: 'gloves',
    icon: '🚗',
    accentColor: '#f43f5e',
    blurb: 'Parts, detailing, tools, and garage upgrades.',
    activityLabel: 'Automotive Deals',
  }),
  Object.freeze({
    id: 'electronics',
    name: 'Electronics',
    rewardType: 'socks',
    icon: '🎧',
    accentColor: '#38bdf8',
    blurb: 'Audio, displays, components, and smart tech.',
    activityLabel: 'Electronics Deals',
  }),
  // Placeholders — give each a rewardType + drop `comingSoon` to activate.
  Object.freeze({
    id: 'luxury',
    name: 'Luxury',
    rewardType: 'shiesty',
    icon: '💎',
    accentColor: '#fbbf24',
    blurb: 'High-end drops and designer finds.',
    activityLabel: 'Luxury Deals',
    camoIds: ['woodland', 'tiger', 'arctic', 'gold', 'diamond', 'darkNebula'],
  }),
  Object.freeze({
    id: 'home',
    name: 'Home',
    rewardType: null,
    icon: '🏠',
    accentColor: '#c084fc',
    blurb: 'Furniture, kitchen, and smart-home upgrades.',
    activityLabel: 'Home Deals',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'gaming',
    name: 'Gaming',
    rewardType: null,
    icon: '🎮',
    accentColor: '#818cf8',
    blurb: 'Consoles, GPUs, peripherals, and collectibles.',
    activityLabel: 'Gaming Deals',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'travel',
    name: 'Travel',
    rewardType: null,
    icon: '✈️',
    accentColor: '#22d3ee',
    blurb: 'Flights, stays, and gear for the road.',
    activityLabel: 'Travel Deals',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'vr',
    name: 'VR',
    rewardType: null,
    icon: '🕶️',
    accentColor: '#e879f9',
    blurb: 'Headsets, haptics, and immersive kit.',
    activityLabel: 'VR Deals',
    comingSoon: true,
  }),
  Object.freeze({
    id: 'accessories',
    name: 'Accessories',
    rewardType: null,
    icon: '🎒',
    accentColor: '#94a3b8',
    blurb: 'The small stuff that finishes the loadout.',
    activityLabel: 'Accessory Deals',
    comingSoon: true,
  }),
]);

/** Categories that currently hand out rewards. */
export const ACTIVE_CAMO_CATEGORIES = Object.freeze(
  CAMO_CATEGORIES.filter((c) => !c.comingSoon && c.rewardType)
);

/* ------------------------------------------------------------------ *
 * Secondary unlock gates (applied on top of the category counter)
 * ------------------------------------------------------------------ */

/**
 * Extra conditions for the higher camos. Metrics are resolved server-side from
 * real account data — never from client input.
 * @type {Readonly<Record<string, ReadonlyArray<{metric: string, min: number, label: string}>>>}
 */
export const CAMO_GATES = Object.freeze({
  woodland: Object.freeze([]),
  tiger: Object.freeze([
    { metric: 'profileLevel', min: 5, label: 'Reach Profile Level 5' },
  ]),
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
});

/* ------------------------------------------------------------------ *
 * Operator rank — derived from real profile level so every Savvy app
 * shows the same rank for the same account.
 * ------------------------------------------------------------------ */

export const OPERATOR_RANKS = Object.freeze([
  Object.freeze({ id: 'recruit', label: 'Recruit', minLevel: 1, color: '#94a3b8' }),
  Object.freeze({ id: 'scout', label: 'Scout', minLevel: 5, color: '#38bdf8' }),
  Object.freeze({ id: 'operator', label: 'Operator', minLevel: 10, color: '#a855f7' }),
  Object.freeze({ id: 'specialist', label: 'Specialist', minLevel: 20, color: '#34d399' }),
  Object.freeze({ id: 'elite', label: 'Elite Operator', minLevel: 30, color: '#ffd166' }),
  Object.freeze({ id: 'apex', label: 'Apex Operator', minLevel: 45, color: '#f472b6' }),
]);

/**
 * @param {number} profileLevel
 * @returns {{id: string, label: string, minLevel: number, color: string}}
 */
export function getOperatorRank(profileLevel) {
  const level = Math.max(1, Number(profileLevel) || 1);
  let rank = OPERATOR_RANKS[0];
  for (const candidate of OPERATOR_RANKS) {
    if (level >= candidate.minLevel) rank = candidate;
  }
  return rank;
}

/* ------------------------------------------------------------------ *
 * ID helpers
 * ------------------------------------------------------------------ */

function slug(value) {
  return String(value || '')
    // camelCase -> kebab-case so `darkNebula` becomes `dark-nebula`
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build the canonical cosmetic ID for a camo item.
 * Shape: `camo_<category>_<camo>_<rewardType>` (e.g. `camo_fitness_dark-nebula_shorts`).
 * @param {string} categoryId
 * @param {string} camoId
 * @param {string} rewardTypeId
 * @returns {string}
 */
export function buildCamoItemId(categoryId, camoId, rewardTypeId) {
  return [CAMO_ID_PREFIX, slug(categoryId), slug(camoId), slug(rewardTypeId)].join('_');
}

/** True when an arbitrary cosmetic ID belongs to the camo locker. */
export function isCamoItemId(id) {
  return typeof id === 'string' && id.startsWith(`${CAMO_ID_PREFIX}_`);
}

export function getCamo(camoId) {
  return CAMOS.find((c) => c.id === camoId) || null;
}

export function getCamoCategory(categoryId) {
  return CAMO_CATEGORIES.find((c) => c.id === categoryId) || null;
}

export function getApparelType(typeId) {
  return APPAREL_TYPES.find((t) => t.id === typeId) || null;
}

export function getCamoRarity(rarityId) {
  return CAMO_RARITIES[rarityId] || CAMO_RARITIES.common;
}

/** Camos available in a category — full ladder unless `camoIds` narrows it. */
export function getCategoryCamos(category) {
  if (category?.camoIds?.length) {
    const allowed = new Set(category.camoIds);
    return CAMOS.filter((c) => allowed.has(c.id));
  }
  return CAMOS;
}

/* ------------------------------------------------------------------ *
 * Catalog generation
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} CamoItemDefinition
 * @property {string} id
 * @property {string} camo            camo id
 * @property {string} camoName
 * @property {string} category        category id
 * @property {string} categoryName
 * @property {string} rewardType      apparel type id
 * @property {string} rewardTypeName
 * @property {string} name            "Dark Nebula Shorts"
 * @property {string} rarity
 * @property {string} rarityLabel
 * @property {string} collectionName
 * @property {string} accentColor
 * @property {string} accentColorAlt
 * @property {number} threshold
 * @property {string} requirementText
 * @property {ReadonlyArray<{metric: string, min: number, label: string}>} gates
 * @property {number} order
 * @property {string} about
 */

function buildItem(category, camo) {
  const apparel = getApparelType(category.rewardType);
  const rarity = getCamoRarity(camo.rarity);
  const rewardTypeName = apparel ? apparel.name : 'Reward';
  return Object.freeze({
    id: buildCamoItemId(category.id, camo.id, category.rewardType),
    camo: camo.id,
    camoName: camo.name,
    category: category.id,
    categoryName: category.name,
    rewardType: category.rewardType,
    rewardTypeName,
    rewardTypePlural: apparel ? apparel.plural : 'Rewards',
    name: `${camo.name} ${rewardTypeName}`,
    rarity: camo.rarity,
    rarityLabel: rarity.label,
    rarityRank: rarity.rank,
    collectionName: camo.collectionName,
    accentColor: camo.accentColor,
    accentColorAlt: camo.accentColorAlt,
    threshold: camo.threshold,
    requirementText: `Find ${camo.threshold} ${category.activityLabel}`,
    gates: CAMO_GATES[camo.id] || Object.freeze([]),
    order: camo.order,
    about: camo.tagline,
  });
}

/** Every camo item in the universe, ordered by category then camo ladder. */
export const CAMO_ITEMS = Object.freeze(
  ACTIVE_CAMO_CATEGORIES.flatMap((category) =>
    getCategoryCamos(category).map((camo) => buildItem(category, camo))
  )
);

/** Fast lookup by item ID. */
const CAMO_ITEMS_BY_ID = Object.freeze(
  CAMO_ITEMS.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, /** @type {Record<string, CamoItemDefinition>} */ ({}))
);

/** All valid camo item IDs — used for server-side ID validation. */
export const CAMO_ITEM_IDS = Object.freeze(CAMO_ITEMS.map((i) => i.id));

/** @returns {CamoItemDefinition|null} */
export function getCamoItem(itemId) {
  return CAMO_ITEMS_BY_ID[itemId] || null;
}

/** Items belonging to one category, in ladder order. */
export function listCamoItemsByCategory(categoryId) {
  return CAMO_ITEMS.filter((i) => i.category === categoryId);
}

/** The same camo across every category (the cross-category "Tiger Collection"). */
export function listCamoItemsByCamo(camoId) {
  return CAMO_ITEMS.filter((i) => i.camo === camoId);
}

/* ------------------------------------------------------------------ *
 * Progress math (shared so client + server always agree)
 * ------------------------------------------------------------------ */

/** Clamp to a 0-100 integer percentage. */
export function toPercent(current, target) {
  const t = Number(target) || 0;
  if (t <= 0) return 100;
  const c = Math.max(0, Number(current) || 0);
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
}

/**
 * Resolve unlock progress for a single item from raw account metrics.
 * @param {CamoItemDefinition} item
 * @param {object} ctx
 * @param {number} ctx.categoryCount how many qualifying actions in this category
 * @param {Record<string, number>} [ctx.metrics] profileLevel, currentStreak, battlePassTier…
 * @returns {{current: number, target: number, progress: number, gatesMet: boolean, gateStatus: Array<{label: string, met: boolean, current: number, min: number}>, requirementsMet: boolean}}
 */
export function evaluateCamoRequirement(item, ctx = {}) {
  const target = item?.threshold || 0;
  const current = Math.max(0, Number(ctx.categoryCount) || 0);
  const metrics = ctx.metrics || {};
  const gateStatus = (item?.gates || []).map((gate) => {
    const value = Math.max(0, Number(metrics[gate.metric]) || 0);
    return { label: gate.label, met: value >= gate.min, current: value, min: gate.min };
  });
  const gatesMet = gateStatus.every((g) => g.met);
  return {
    current: Math.min(current, target),
    target,
    progress: toPercent(current, target),
    gatesMet,
    gateStatus,
    requirementsMet: current >= target && gatesMet,
  };
}

/**
 * Summarise a set of items against an unlocked-ID set.
 * @param {ReadonlyArray<CamoItemDefinition>} items
 * @param {Set<string>|string[]} unlockedIds
 */
export function summarizeCamoProgress(items, unlockedIds) {
  const set = unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds || []);
  const list = items || [];
  const unlocked = list.filter((i) => set.has(i.id));
  const highest = unlocked.reduce(
    (best, i) => (!best || i.order > best.order ? i : best),
    /** @type {CamoItemDefinition|null} */ (null)
  );
  return {
    total: list.length,
    unlocked: unlocked.length,
    percent: list.length ? toPercent(unlocked.length, list.length) : 0,
    highestCamo: highest ? highest.camoName : null,
    highestCamoId: highest ? highest.camo : null,
  };
}

/** Locker-wide totals ("12 / 30 Camos Unlocked · 40% Collection Complete"). */
export function summarizeLocker(unlockedIds) {
  return summarizeCamoProgress(CAMO_ITEMS, unlockedIds);
}

/**
 * Per-camo collection rollup for the "WOODLAND COLLECTION 4 / 5" section.
 * @param {Set<string>|string[]} unlockedIds
 */
export function summarizeCamoCollections(unlockedIds) {
  const set = unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds || []);
  return CAMOS.map((camo) => {
    const items = listCamoItemsByCamo(camo.id);
    const unlocked = items.filter((i) => set.has(i.id));
    return {
      camo: camo.id,
      camoName: camo.name,
      collectionName: camo.collectionName,
      rarity: camo.rarity,
      accentColor: camo.accentColor,
      accentColorAlt: camo.accentColorAlt,
      total: items.length,
      unlocked: unlocked.length,
      percent: toPercent(unlocked.length, items.length),
      complete: items.length > 0 && unlocked.length === items.length,
      items: items.map((i) => ({
        id: i.id,
        rewardTypeName: i.rewardTypeName,
        category: i.category,
        unlocked: set.has(i.id),
      })),
    };
  });
}

/** Per-category rollup for the category cards. */
export function summarizeCamoCategories(unlockedIds) {
  const set = unlockedIds instanceof Set ? unlockedIds : new Set(unlockedIds || []);
  return ACTIVE_CAMO_CATEGORIES.map((category) => {
    const items = listCamoItemsByCategory(category.id);
    const summary = summarizeCamoProgress(items, set);
    return { ...category, ...summary };
  });
}
