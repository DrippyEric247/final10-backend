/**
 * Deal Streak egg milestone grants — idempotent, server-authoritative.
 */
const { ensurePerkMachineDoc } = require('./perkMachineService');
const { ensureDealStreakDoc } = require('./dealStreakService');
const { getDealStreakEggMilestone } = require('../config/dealStreakMilestones');

async function grantDealStreakEggMilestone(user, streak) {
  const milestone = getDealStreakEggMilestone(streak);
  if (!milestone) {
    return { granted: false, reason: 'no_milestone' };
  }

  const ds = ensureDealStreakDoc(user);
  const claimed = ds.streakMilestonesClaimed || [];
  if (claimed.includes(milestone.milestoneKey)) {
    return {
      granted: false,
      duplicate: true,
      milestoneKey: milestone.milestoneKey,
      eggTier: milestone.eggTier,
    };
  }

  const pm = ensurePerkMachineDoc(user);
  const tier = milestone.eggTier;
  if (pm.eggInventory[tier] == null) {
    pm.eggInventory[tier] = 0;
  }
  pm.eggInventory[tier] = Number(pm.eggInventory[tier]) + 1;

  try {
    const { isHatchableEggTier } = require('../config/eggCamoCollection');
    if (isHatchableEggTier(tier)) {
      const { recordLegitimateEggAcquisition } = require('./eggCamoProgressService');
      await recordLegitimateEggAcquisition(user, {
        tier,
        quantity: 1,
        source: 'deal_streak_milestone',
        skipSave: true,
        meta: { milestoneKey: milestone.milestoneKey, streak },
      });
    }
  } catch (err) {
    console.error('[deal-streak] egg camo tracking failed', err?.message || err);
  }

  if (!claimed.includes(milestone.milestoneKey)) {
    ds.streakMilestonesClaimed.push(milestone.milestoneKey);
  }

  user.markModified('dealStreak');
  user.markModified('perkMachine');

  return {
    granted: true,
    duplicate: false,
    milestoneKey: milestone.milestoneKey,
    streak,
    eggTier: tier,
    label: milestone.label,
  };
}

/**
 * Evaluate and grant any egg milestone for the current streak count.
 */
async function evaluateDealStreakEggMilestones(user, streak) {
  const milestone = getDealStreakEggMilestone(streak);
  if (!milestone) {
    return { granted: false, reason: 'no_milestone_at_streak' };
  }
  return grantDealStreakEggMilestone(user, streak);
}

module.exports = {
  grantDealStreakEggMilestone,
  evaluateDealStreakEggMilestones,
};
