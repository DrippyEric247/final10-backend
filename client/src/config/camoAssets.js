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
  CAMOS,
  ACTIVE_CAMO_CATEGORIES,
  getApparelType,
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
    const apparelId = category.rewardType;
    map[category.id] = { [apparelId]: {} };
    for (const camo of CAMOS) {
      map[category.id][apparelId][camo.id] = conventionPath(category.id, apparelId, camo.id);
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
export const CAMO_ASSET_OVERRIDES = {};

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
  return conventionPath(item.category, item.rewardType, item.camo, { preview: true });
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
