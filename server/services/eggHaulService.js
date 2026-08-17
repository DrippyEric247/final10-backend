/**
 * Egg Haul — guaranteed Mythic-tier Egg bundle grant.
 */
const { ensurePerkMachineDoc } = require('./perkMachineService');
const { EGG_HAUL_BUNDLE_SIZE, EGG_HAUL_DISTRIBUTION } = require('../config/eggHaulConfig');

async function grantEggHaul(user, idempotencyKey) {
  const key = String(idempotencyKey || '').trim();
  if (!key) {
    throw new Error('grantEggHaul requires idempotencyKey');
  }

  const pm = ensurePerkMachineDoc(user);
  if (!pm.eggHaulGrants) pm.eggHaulGrants = [];
  const prior = pm.eggHaulGrants.find((g) => g.idempotencyKey === key);
  if (prior) {
    return {
      granted: false,
      duplicate: true,
      bundleSize: EGG_HAUL_BUNDLE_SIZE,
      distribution: prior.distribution,
      totalEggs: prior.totalEggs,
    };
  }

  const distribution = [];
  let totalEggs = 0;

  for (const row of EGG_HAUL_DISTRIBUTION) {
    const tier = row.eggTier;
    const qty = Math.max(0, Number(row.quantity) || 0);
    if (!tier || qty <= 0) continue;

    if (pm.eggInventory[tier] == null) pm.eggInventory[tier] = 0;
    pm.eggInventory[tier] = Number(pm.eggInventory[tier]) + qty;
    totalEggs += qty;
    distribution.push({ eggTier: tier, quantity: qty });

    try {
      const { isHatchableEggTier } = require('../config/eggCamoCollection');
      if (isHatchableEggTier(tier)) {
        const { recordLegitimateEggAcquisition } = require('./eggCamoProgressService');
        await recordLegitimateEggAcquisition(user, {
          tier,
          quantity: qty,
          source: 'egg_haul',
          skipSave: true,
          meta: { idempotencyKey: key },
        });
      }
    } catch (err) {
      console.error('[egg-haul] camo tracking failed', err?.message || err);
    }
  }

  pm.eggHaulGrants.push({
    idempotencyKey: key,
    grantedAt: new Date(),
    distribution,
    totalEggs,
  });
  if (pm.eggHaulGrants.length > 50) {
    pm.eggHaulGrants = pm.eggHaulGrants.slice(-50);
  }

  user.markModified('perkMachine');

  return {
    granted: true,
    duplicate: false,
    bundleSize: EGG_HAUL_BUNDLE_SIZE,
    distribution,
    totalEggs,
  };
}

module.exports = {
  grantEggHaul,
};
