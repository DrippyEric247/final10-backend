/**
 * CAMO LOCKER IMAGE MAP — the only file you need to touch to swap artwork.
 *
 * Every camo/apparel combination resolves to an image URL here. Paths are
 * generated from a convention by default, so dropping a file at the expected
 * path is enough. Add an entry to `CAMO_ASSET_OVERRIDES` when a render lives
 * somewhere else (CDN, hashed filename, different extension, etc.).
 *
 * Convention:
 *   /assets/camo/<category>/<apparel-folder>/<camo>.png
 *   /assets/camo/fitness/shorts/dark-nebula.png
 *
 * Preview (hi-res) convention — falls back to the card image when absent:
 *   /assets/camo/<category>/<apparel-folder>/<camo>-preview.png
 *
 * Images are rendered with `object-fit: contain`, so apparel is never cropped.
 * Use square or 4:5 transparent PNGs at 2x (e.g. 1200x1500) for retina.
 */

import {
  ACTIVE_CAMO_CATEGORIES,
  getApparelType,
  getCategoryCamos,
  getCategoryRewardTypes,
} from '@savvy/core/config/camoLocker';

/** Root folder for all camo renders (served from `client/public`). */
export const CAMO_ASSET_ROOT = '/assets/camo';

/** Shown while a render is missing so the locker never looks broken. */
export const CAMO_ASSET_PLACEHOLDER = `${CAMO_ASSET_ROOT}/placeholder.png`;

/** File extension used by the generated convention. */
const DEFAULT_EXT = 'png';

/** `darkNebula` -> `dark-nebula` for filesystem-friendly names. */
function kebab(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function conventionPath(categoryId, apparelId, camoId, { preview = false } = {}) {
  const apparel = getApparelType(apparelId);
  const folder = apparel?.assetSlug || kebab(apparelId);
  const file = `${kebab(camoId)}${preview ? '-preview' : ''}.${DEFAULT_EXT}`;
  return `${CAMO_ASSET_ROOT}/${kebab(categoryId)}/${folder}/${file}`;
}

/**
 * Generated map: camoAssets[category][apparel][camo] = url
 *
 * e.g. camoAssets.fitness.shorts.woodland === '/assets/camo/fitness/shorts/woodland.png'
 */
function buildCamoAssets() {
  const map = {};
  for (const category of ACTIVE_CAMO_CATEGORIES) {
    map[category.id] = {};
    for (const apparelId of getCategoryRewardTypes(category)) {
      map[category.id][apparelId] = {};
      for (const camo of getCategoryCamos(category, apparelId)) {
        map[category.id][apparelId][camo.id] = conventionPath(category.id, apparelId, camo.id);
      }
    }
  }
  return map;
}

export const camoAssets = buildCamoAssets();

/**
 * Explicit overrides. Keys are the full camo item ID
 * (`camo_<category>_<camo>_<rewardType>`), values are `{ image, preview }`.
 *
 * Example:
 *   'camo_fitness_dark-nebula_shorts': {
 *     image: 'https://cdn.savvy.app/camo/fitness-shorts-dark-nebula@2x.webp',
 *     preview: 'https://cdn.savvy.app/camo/fitness-shorts-dark-nebula-hero@2x.webp',
 *   },
 */
export const CAMO_ASSET_OVERRIDES = {
  /** Woodland Hoodie — full collectible display art (jpeg per art drop). */
  camo_outdoor_woodland_hoodie: {
    image: `${CAMO_ASSET_ROOT}/outdoor/hoodies/camo_woodland_hoodie.jpeg`,
  },
  /** Tiger Hoodie — full collectible display art (jpeg per art drop). */
  camo_outdoor_tiger_hoodie: {
    image: `${CAMO_ASSET_ROOT}/outdoor/hoodies/camo_tiger_hoodie.jpeg`,
  },
  /** Arctic Hoodie — full collectible display art (jpeg per art drop). */
  camo_outdoor_arctic_hoodie: {
    image: `${CAMO_ASSET_ROOT}/outdoor/hoodies/camo_arctic_hoodie.jpeg`,
  },
  /** Gold Hoodie — full collectible display art (jpeg per art drop). */
  camo_outdoor_gold_hoodie: {
    image: `${CAMO_ASSET_ROOT}/outdoor/hoodies/camo_gold_hoodie.jpeg`,
  },
  /** Diamond Hoodie — full collectible display art (jpeg per art drop). */
  camo_outdoor_diamond_hoodie: {
    image: `${CAMO_ASSET_ROOT}/outdoor/hoodies/camo_diamond_hoodie.jpeg`,
  },
  /** Dark Nebula Hoodie — full collectible display art (jpeg per art drop). */
  'camo_outdoor_dark-nebula_hoodie': {
    image: `${CAMO_ASSET_ROOT}/outdoor/hoodies/camo_dark_nebula_hoodie.jpeg`,
  },
  /** Woodland Gloves — full collectible display art (jpeg per art drop). */
  camo_automotive_woodland_gloves: {
    image: `${CAMO_ASSET_ROOT}/automotive/gloves/camo_woodland_gloves.jpeg`,
  },
  /** Tiger Gloves — full collectible display art (jpeg per art drop). */
  camo_automotive_tiger_gloves: {
    image: `${CAMO_ASSET_ROOT}/automotive/gloves/camo_tiger_gloves.jpeg`,
  },
  /** Arctic Gloves — full collectible display art (jpeg per art drop). */
  camo_automotive_arctic_gloves: {
    image: `${CAMO_ASSET_ROOT}/automotive/gloves/camo_arctic_gloves.jpeg`,
  },
  /** Gold Gloves — full collectible display art (jpeg per art drop). */
  camo_automotive_gold_gloves: {
    image: `${CAMO_ASSET_ROOT}/automotive/gloves/camo_gold_gloves.jpeg`,
  },
  /** Diamond Gloves — full collectible display art (jpeg per art drop). */
  camo_automotive_diamond_gloves: {
    image: `${CAMO_ASSET_ROOT}/automotive/gloves/camo_diamond_gloves.jpeg`,
  },
  /** Dark Nebula Gloves — full collectible display art (jpeg per art drop). */
  'camo_automotive_dark-nebula_gloves': {
    image: `${CAMO_ASSET_ROOT}/automotive/gloves/camo_dark_nebula_gloves.jpeg`,
  },
  /** Woodland Shorts — full collectible display art (jpeg per art drop). */
  camo_fitness_woodland_shorts: {
    image: `${CAMO_ASSET_ROOT}/fitness/shorts/camo_woodland_shorts.jpeg`,
  },
  /** Tiger Shorts — full collectible display art (jpeg per art drop). */
  camo_fitness_tiger_shorts: {
    image: `${CAMO_ASSET_ROOT}/fitness/shorts/camo_tiger_shorts.jpeg`,
  },
  /** Arctic Shorts — full collectible display art (jpeg per art drop). */
  camo_fitness_arctic_shorts: {
    image: `${CAMO_ASSET_ROOT}/fitness/shorts/camo_arctic_shorts.jpeg`,
  },
  /** Gold Shorts — full collectible display art (jpeg per art drop). */
  camo_fitness_gold_shorts: {
    image: `${CAMO_ASSET_ROOT}/fitness/shorts/camo_gold_shorts.jpeg`,
  },
  /** Diamond Shorts — full collectible display art (jpeg per art drop). */
  camo_fitness_diamond_shorts: {
    image: `${CAMO_ASSET_ROOT}/fitness/shorts/camo_diamond_shorts.jpeg`,
  },
  /** Dark Nebula Shorts — full collectible display art (jpeg per art drop). */
  'camo_fitness_dark-nebula_shorts': {
    image: `${CAMO_ASSET_ROOT}/fitness/shorts/camo_dark_nebula_shorts.jpeg`,
  },
  /** Nuke Streak Shorts — private admin/owner preview art (Fitness). */
  'camo_fitness_nuke-streak_shorts': {
    image: `${CAMO_ASSET_ROOT}/fitness/shorts/camo_nuke_streak_shorts.jpeg`,
  },
  /** Woodland Socks — full collectible display art (jpeg per art drop). */
  camo_electronics_woodland_socks: {
    image: `${CAMO_ASSET_ROOT}/electronics/socks/camo_woodland_socks.jpeg`,
  },
  /** Tiger Socks — full collectible display art (jpeg per art drop). */
  camo_electronics_tiger_socks: {
    image: `${CAMO_ASSET_ROOT}/electronics/socks/camo_tiger_socks.jpeg`,
  },
  /** Arctic Socks — full collectible display art (jpeg per art drop). */
  camo_electronics_arctic_socks: {
    image: `${CAMO_ASSET_ROOT}/electronics/socks/camo_arctic_socks.jpeg`,
  },
  /** Gold Socks — full collectible display art (jpeg per art drop). */
  camo_electronics_gold_socks: {
    image: `${CAMO_ASSET_ROOT}/electronics/socks/camo_gold_socks.jpeg`,
  },
  /** Diamond Socks — full collectible display art (jpeg per art drop). */
  camo_electronics_diamond_socks: {
    image: `${CAMO_ASSET_ROOT}/electronics/socks/camo_diamond_socks.jpeg`,
  },
  /** Dark Nebula Socks — full collectible display art (jpeg per art drop). */
  'camo_electronics_dark-nebula_socks': {
    image: `${CAMO_ASSET_ROOT}/electronics/socks/camo_dark_nebula_socks.jpeg`,
  },
  /** Woodland Shiesty — full collectible display art (jpeg per art drop). */
  camo_luxury_woodland_shiesty: {
    image: `${CAMO_ASSET_ROOT}/luxury/shiesties/camo_woodland_shiesty.jpeg`,
  },
  /** Tiger Shiesty — full collectible display art (jpeg per art drop). */
  camo_luxury_tiger_shiesty: {
    image: `${CAMO_ASSET_ROOT}/luxury/shiesties/camo_tiger_shiesty.jpeg`,
  },
  /** Arctic Shiesty — full collectible display art (jpeg per art drop). */
  camo_luxury_arctic_shiesty: {
    image: `${CAMO_ASSET_ROOT}/luxury/shiesties/camo_arctic_shiesty.jpeg`,
  },
  /** Gold Shiesty — full collectible display art (jpeg per art drop). */
  camo_luxury_gold_shiesty: {
    image: `${CAMO_ASSET_ROOT}/luxury/shiesties/camo_gold_shiesty.jpeg`,
  },
  /** Diamond Shiesty — full collectible display art (jpeg per art drop). */
  camo_luxury_diamond_shiesty: {
    image: `${CAMO_ASSET_ROOT}/luxury/shiesties/camo_diamond_shiesty.jpeg`,
  },
  /** Dark Nebula Shiesty — full collectible display art (jpeg per art drop). */
  'camo_luxury_dark-nebula_shiesty': {
    image: `${CAMO_ASSET_ROOT}/luxury/shiesties/camo_dark_nebula_shiesty.jpeg`,
  },
  /** Nuke Streak Shiesty Mask — private admin/owner preview art. */
  'camo_luxury_nuke-streak_shiesty': {
    image: `${CAMO_ASSET_ROOT}/luxury/shiesties/camo_nuke_streak_shiesty.jpeg`,
  },
  /** Nuke Gloves — private admin/owner preview art (Automotive). */
  'camo_automotive_nuke-streak_gloves': {
    image: `${CAMO_ASSET_ROOT}/automotive/gloves/camo_nuke_streak_gloves.jpeg`,
  },
  /** Nuke Socks — private admin/owner preview art (Electronics). */
  'camo_electronics_nuke-streak_socks': {
    image: `${CAMO_ASSET_ROOT}/electronics/socks/camo_nuke_streak_socks.jpeg`,
  },
  /** Nuke Streak T-Shirt — private admin/owner preview art (Retail). */
  'camo_retail_nuke-streak_tshirt': {
    image: `${CAMO_ASSET_ROOT}/retail/tshirts/camo_nuke_streak_tshirt.jpeg`,
  },
  /** Nuke Hoodie — private admin/owner preview art (Retail). */
  'camo_retail_nuke-streak_hoodie': {
    image: `${CAMO_ASSET_ROOT}/retail/hoodies/camo_nuke_streak_hoodie.jpeg`,
  },
  /** Tiger T-Shirt — full collectible display art (jpeg per art drop). */
  camo_retail_tiger_tshirt: {
    image: `${CAMO_ASSET_ROOT}/retail/tshirts/camo_tiger_tshirt.jpeg`,
  },
  /** Arctic T-Shirt — full collectible display art (jpeg per art drop). */
  camo_retail_arctic_tshirt: {
    image: `${CAMO_ASSET_ROOT}/retail/tshirts/camo_arctic_tshirt.jpeg`,
  },
  /** Gold T-Shirt — full collectible display art (jpeg per art drop). */
  camo_retail_gold_tshirt: {
    image: `${CAMO_ASSET_ROOT}/retail/tshirts/camo_gold_tshirt.jpeg`,
  },
  /** Diamond T-Shirt — full collectible display art (jpeg per art drop). */
  camo_retail_diamond_tshirt: {
    image: `${CAMO_ASSET_ROOT}/retail/tshirts/camo_diamond_tshirt.jpeg`,
  },
  /** Dark Nebula T-Shirt — full collectible display art (jpeg per art drop). */
  'camo_retail_dark-nebula_tshirt': {
    image: `${CAMO_ASSET_ROOT}/retail/tshirts/camo_dark_nebula_tshirt.jpeg`,
  },
};

/**
 * Category hero art (the big image on each category card). Optional — the card
 * falls back to the highest-rarity camo render, then the category icon.
 */
export const CAMO_CATEGORY_HERO_OVERRIDES = {};

function categoryHeroConvention(categoryId) {
  return `${CAMO_ASSET_ROOT}/${kebab(categoryId)}/hero.png`;
}

/**
 * Resolve the card image for a camo item.
 * @param {{id: string, category: string, rewardType: string, camo: string}} item
 * @returns {string}
 */
export function resolveCamoImage(item) {
  if (!item) return CAMO_ASSET_PLACEHOLDER;
  const override = CAMO_ASSET_OVERRIDES[item.id];
  if (override?.image) return override.image;
  return (
    camoAssets?.[item.category]?.[item.rewardType]?.[item.camo] ||
    conventionPath(item.category, item.rewardType, item.camo)
  );
}

/**
 * Resolve the large preview/detail image. Falls back to the card image.
 * @param {{id: string, category: string, rewardType: string, camo: string}} item
 * @returns {string}
 */
export function resolveCamoPreviewImage(item) {
  if (!item) return CAMO_ASSET_PLACEHOLDER;
  const override = CAMO_ASSET_OVERRIDES[item.id];
  if (override?.preview) return override.preview;
  // Dedicated `-preview` renders are optional — card art is the default hero.
  return resolveCamoImage(item);
}

/**
 * Resolve category card art.
 * @param {string} categoryId
 * @returns {string}
 */
export function resolveCategoryHeroImage(categoryId) {
  return CAMO_CATEGORY_HERO_OVERRIDES[categoryId] || categoryHeroConvention(categoryId);
}

/**
 * Attach resolved image URLs to a catalog item.
 * @template {object} T
 * @param {T} item
 * @returns {T & {imageUrl: string, previewImageUrl: string}}
 */
export function withCamoImages(item) {
  return {
    ...item,
    imageUrl: resolveCamoImage(item),
    previewImageUrl: resolveCamoPreviewImage(item),
  };
}
