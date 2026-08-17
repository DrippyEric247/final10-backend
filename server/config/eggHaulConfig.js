/**
 * Egg Haul — Mythic-tier guaranteed Egg bundle distribution.
 * Tune counts here without code changes (must sum to bundleSize).
 */

const EGG_HAUL_BUNDLE_SIZE = 20;

/** Guaranteed rarity spread for the Egg Haul bundle. */
const EGG_HAUL_DISTRIBUTION = Object.freeze([
  { eggTier: 'common', quantity: 4 },
  { eggTier: 'rare', quantity: 4 },
  { eggTier: 'epic', quantity: 4 },
  { eggTier: 'legendary', quantity: 4 },
  { eggTier: 'mythic', quantity: 4 },
]);

function validateEggHaulConfig() {
  const total = EGG_HAUL_DISTRIBUTION.reduce((sum, row) => sum + row.quantity, 0);
  if (total !== EGG_HAUL_BUNDLE_SIZE) {
    throw new Error(
      `Egg Haul distribution must total ${EGG_HAUL_BUNDLE_SIZE}, got ${total}`
    );
  }
}

validateEggHaulConfig();

module.exports = {
  EGG_HAUL_BUNDLE_SIZE,
  EGG_HAUL_DISTRIBUTION,
};
