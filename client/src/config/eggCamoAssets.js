/**
 * Egg Camo Collection image map.
 *
 * Drop official artwork at the convention paths below, or override individual
 * camos in `EGG_CAMO_ASSET_OVERRIDES` when filenames differ.
 *
 * Convention:
 *   /assets/egg-camo/<camo-id>.jpeg
 *   /assets/egg-camo/<camo-id>-preview.jpeg  (optional hero — falls back to card)
 */

import { EGG_CAMO_IDS } from '@savvy/core/config/eggCamoCollection';

export const EGG_CAMO_ASSET_ROOT = '/assets/egg-camo';
export const EGG_CAMO_ASSET_PLACEHOLDER = `${EGG_CAMO_ASSET_ROOT}/placeholder.png`;

function kebab(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function conventionPath(camoId, { preview = false } = {}) {
  const file = `${kebab(camoId)}${preview ? '-preview' : ''}.jpeg`;
  return `${EGG_CAMO_ASSET_ROOT}/${file}`;
}

/** Generated defaults — swap files on disk or use overrides. */
export const eggCamoAssets = Object.freeze(
  EGG_CAMO_IDS.reduce((acc, id) => {
    acc[id] = conventionPath(id);
    return acc;
  }, {})
);

/**
 * Explicit overrides keyed by camo id (`woodland`, `tiger`, …).
 * @type {Record<string, { image?: string, preview?: string }>}
 */
export const EGG_CAMO_ASSET_OVERRIDES = {
  // Example after art drop:
  // woodland: { image: `${EGG_CAMO_ASSET_ROOT}/woodland.jpeg` },
};

export function resolveEggCamoImage(camoId) {
  const override = EGG_CAMO_ASSET_OVERRIDES[camoId];
  if (override?.image) return override.image;
  return eggCamoAssets[camoId] || conventionPath(camoId);
}

export function resolveEggCamoPreviewImage(camoId) {
  const override = EGG_CAMO_ASSET_OVERRIDES[camoId];
  if (override?.preview) return override.preview;
  return resolveEggCamoImage(camoId);
}

export function withEggCamoImages(item) {
  if (!item) return item;
  return {
    ...item,
    imageUrl: resolveEggCamoImage(item.id),
    previewImageUrl: resolveEggCamoPreviewImage(item.id),
  };
}
