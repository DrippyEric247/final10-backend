/**
 * Server-authoritative contract reward grants — all schema-supported reward types.
 */
const { grantSavvyReward } = require('./savvyRewardService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const { emptyEggInventory } = require('../config/perkMachineRewards');
const { ensureEventInventory } = require('./scoutFlightTicketService');

function ensurePerkMachine(user) {
  if (!user.perkMachine || typeof user.perkMachine !== 'object') {
    user.perkMachine = {};
  }
  const pm = user.perkMachine;
  if (!pm.eggInventory) pm.eggInventory = emptyEggInventory();
  if (!pm.tokens || typeof pm.tokens !== 'object') {
    pm.tokens = { battlePassXp15: 0, savvyLevelXp15: 0, savvyMultiplier15: 0, paid3Spin: 0, paid2Spin: 0 };
  }
  if (typeof pm.extraFreeSpins !== 'number') pm.extraFreeSpins = 0;
  if (typeof pm.tokens.paid3Spin !== 'number') pm.tokens.paid3Spin = 0;
  return pm;
}

/**
 * Grant a contract reward once (ContractProgress.claimedAt is the primary duplicate guard).
 * @param {import('../models/User')} user
 * @param {{ contract: object, periodKey: string, reward: object }} params
 */
async function grantContractReward(user, { contract, periodKey, reward }) {
  const idempotencyBase = `contract:${user._id}:${contract.id}:${periodKey}`;
  const type = String(reward?.type || 'savvy');

  if (type === 'savvy' || type === 'savvy_coins') {
    const amount = Math.max(1, Math.round(Number(reward.amount) || 0));
    const multiplierEligible =
      reward.multiplierEligible === true || reward.rewardClass === 'earning';
    const result = await grantSavvyReward(user, {
      rewardType: 'contract_reward',
      amount,
      baseAmount: amount,
      idempotencyKey: `${idempotencyBase}:savvy`,
      note: `Contract: ${contract.title}`,
      meta: {
        contractId: contract.id,
        periodKey,
        appId: contract.appId,
        rewardType: type,
        policySource: 'contract_config',
        multiplierEligible,
        rewardClass: multiplierEligible ? 'earning' : 'fixed',
      },
    });
    return {
      granted: Boolean(result.granted),
      duplicate: Boolean(result.duplicate),
      amount: result.amount || 0,
      newBalance: result.newBalance,
      rewardType: type,
    };
  }

  if (type === 'perk_spin') {
    const pm = ensurePerkMachine(user);
    const tokenKey = reward.spinToken || 'paid3Spin';
    const qty = Math.max(1, Math.round(Number(reward.amount) || 1));
    if (tokenKey === 'extraFreeSpins') {
      pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + qty;
    } else {
      pm.tokens[tokenKey] = Number(pm.tokens[tokenKey] || 0) + qty;
    }
    user.markModified('perkMachine');
    await user.save();
    return { granted: true, duplicate: false, amount: qty, rewardType: type };
  }

  if (type === 'egg') {
    const pm = ensurePerkMachine(user);
    const tier = reward.eggTier || 'common';
    const qty = Math.max(1, Math.round(Number(reward.amount) || 1));
    if (tier === 'extraFreeSpin') {
      pm.eggInventory.extraFreeSpin = Number(pm.eggInventory.extraFreeSpin || 0) + qty;
    } else if (pm.eggInventory[tier] != null) {
      pm.eggInventory[tier] = Number(pm.eggInventory[tier] || 0) + qty;
    } else {
      const err = new Error(`Unknown egg tier: ${tier}`);
      err.code = 'INVALID_EGG_TIER';
      throw err;
    }
    user.markModified('perkMachine');
    await user.save();
    try {
      const { isHatchableEggTier } = require('../config/eggCamoCollection');
      if (isHatchableEggTier(tier)) {
        const { recordLegitimateEggAcquisition } = require('./eggCamoProgressService');
        await recordLegitimateEggAcquisition(user, {
          tier,
          quantity: qty,
          source: 'contract_reward',
          skipSave: true,
        });
        await user.save();
      }
    } catch (err) {
      console.warn('[contracts] egg camo tracking failed:', err?.message || err);
    }
    return { granted: true, duplicate: false, amount: qty, rewardType: type, eggTier: tier };
  }

  if (type === 'scout_flight_ticket') {
    ensureEventInventory(user);
    const qty = Math.max(1, Math.round(Number(reward.amount) || 1));
    user.eventInventory.scoutFlightTicket = Number(user.eventInventory.scoutFlightTicket || 0) + qty;
    user.markModified('eventInventory');
    await user.save();
    return { granted: true, duplicate: false, amount: qty, rewardType: type };
  }

  if (type === 'cosmetic') {
    if (!reward.cosmeticId) {
      const err = new Error('cosmeticId required for cosmetic reward');
      err.code = 'INVALID_REWARD';
      throw err;
    }
    const isNew = await grantSystemCosmeticUnlock(user._id, reward.cosmeticId, 'contract_reward');
    return {
      granted: true,
      duplicate: !isNew,
      amount: isNew ? 1 : 0,
      rewardType: type,
      cosmeticId: reward.cosmeticId,
    };
  }

  if (type === 'contract_xp') {
    const { grantProfileXp } = require('./profileXpService');
    const amount = Math.max(1, Math.round(Number(reward.amount) || 45));
    const result = await grantProfileXp(user, {
      source: 'contract_completed',
      amount,
      idempotencyKey: `${idempotencyBase}:xp`,
      note: `Contract: ${contract.title}`,
      meta: { contractId: contract.id, periodKey },
    });
    return {
      granted: result.granted !== false && !result.duplicate,
      duplicate: Boolean(result.duplicate),
      amount: result.amount || amount,
      rewardType: type,
    };
  }

  if (type === 'multiplier') {
    const pm = ensurePerkMachine(user);
    const tokenKey = reward.multiplierKey || 'savvyMultiplier15';
    const qty = Math.max(1, Math.round(Number(reward.amount) || 1));
    pm.tokens[tokenKey] = Number(pm.tokens[tokenKey] || 0) + qty;
    user.markModified('perkMachine');
    await user.save();
    return { granted: true, duplicate: false, amount: qty, rewardType: type, tokenKey };
  }

  const err = new Error(`Unsupported contract reward type: ${type}`);
  err.code = 'UNSUPPORTED_REWARD';
  throw err;
}

module.exports = {
  grantContractReward,
};
