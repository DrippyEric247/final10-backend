/**
 * Egg Keychain Collection image map.
 */

import { EGG_KEYCHAIN_ITEMS } from '@savvy/core/config/eggKeychainCollection';

export const EGG_KEYCHAIN_ASSET_ROOT = '/assets/egg-keychains';

/** @type {Record<string, string>} */
export const eggKeychainAssets = Object.freeze(
  EGG_KEYCHAIN_ITEMS.reduce((acc, item) => {
    acc[item.id] = item.assetPath;
    return acc;
  }, {})
);

export function resolveEggKeychainImage(itemId) {
  return eggKeychainAssets[itemId] || `${EGG_KEYCHAIN_ASSET_ROOT}/placeholder.jpeg`;
}

export function withEggKeychainImages(item) {
  if (!item) return item;
  return {
    ...item,
    imageUrl: item.assetPath || resolveEggKeychainImage(item.id),
  };
}
