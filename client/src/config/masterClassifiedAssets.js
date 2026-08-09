/**
 * Classified / Master Collection artwork paths.
 * SOURCE OF TRUTH for poster asset URLs: packages/savvy-core masterClassifiedCollection config.
 */

import {
  MASTER_CLASSIFIED_ITEMS,
  MASTER_CLASSIFIED_HERO_ASSET,
} from '@savvy/core/config/masterClassifiedCollection';

const ASSET_OVERRIDES = Object.freeze({
  master_classified_hat: '/assets/classified/master-hat.png',
  master_classified_mask: '/assets/classified/master-mask.png',
  master_classified_tshirt: '/assets/classified/master-tshirt.png',
  master_classified_arm_sleeve: '/assets/classified/master-arm-sleeve.png',
  master_classified_shorts: '/assets/classified/master-shorts.png',
  master_classified_leg_sleeve: '/assets/classified/master-leg-sleeve.png',
  master_classified_socks: '/assets/classified/master-socks.png',
  master_classified_glasses: '/assets/classified/master-glasses.png',
  master_classified_custom_shoe_ticket: '/assets/classified/master-custom-shoe-ticket.png',
});

/** @param {string} itemId */
export function resolveMasterClassifiedAsset(itemId) {
  if (ASSET_OVERRIDES[itemId]) return ASSET_OVERRIDES[itemId];
  const def = MASTER_CLASSIFIED_ITEMS.find((i) => i.id === itemId);
  return def?.assetPath || null;
}

export function getMasterClassifiedHeroAsset() {
  return MASTER_CLASSIFIED_HERO_ASSET;
}

export function withMasterClassifiedImages(item) {
  if (!item) return item;
  return {
    ...item,
    imageUrl: item.assetPath || resolveMasterClassifiedAsset(item.id),
    previewImageUrl: item.assetPath || resolveMasterClassifiedAsset(item.id),
  };
}
