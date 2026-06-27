/**
 * Applies event rewards (Supply Drops, Scout Support placeholders) into live inventories.
 */

const crypto = require('crypto');
const { grantSavvyReward } = require('./savvyRewardService');
const { ensurePerkMachineDoc } = require('./perkMachineService');
const { adminGrantXp } = require('./battlePassClaimService');
const { rewardToSummary } = require('../config/supplyDropRewards');

async function applyEventReward(user, rewardDef, idempotencyPrefix) {
  const reward = { ...rewardDef };
  const prefix = idempotencyPrefix || `event:${user._id}:${crypto.randomUUID()}`;
  const summary = rewardToSummary(reward);
  const granted = { ...summary, granted: true };

  if (reward.type === 'savvy') {
    const amount = Math.max(0, Number(reward.amount) || 0);
    const result = await grantSavvyReward(user, {
      rewardType: 'supply_drop',
      amount,
      idempotencyKey: `${prefix}:savvy:${amount}`,
      note: `Supply Drop — ${reward.label}`,
      meta: { source: 'supply_drop' },
    });
    granted.savvyGranted = result.amount;
    granted.newBalance = result.newBalance;
  } else if (reward.type === 'free_spin') {
    const pm = ensurePerkMachineDoc(user);
    pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + 1;
    user.markModified('perkMachine');
  } else if (reward.type === 'egg') {
    const pm = ensurePerkMachineDoc(user);
    const tier = reward.eggTier;
    if (tier === 'extraFreeSpin') {
      pm.eggInventory.extraFreeSpin = Number(pm.eggInventory.extraFreeSpin || 0) + 1;
      pm.extraFreeSpins = Number(pm.extraFreeSpins || 0) + 1;
    } else if (tier && pm.eggInventory[tier] != null) {
      pm.eggInventory[tier] = Number(pm.eggInventory[tier] || 0) + 1;
    }
    user.markModified('perkMachine');
  } else if (reward.type === 'egg_chance_epic') {
    const pm = ensurePerkMachineDoc(user);
    const chance = Number(reward.epicChance) || 0.35;
    const wonEpic = Math.random() < chance;
    if (wonEpic) {
      pm.eggInventory.epic = Number(pm.eggInventory.epic || 0) + 1;
      granted.label = 'Epic Egg';
      granted.eggTier = 'epic';
      granted.epicRoll = true;
    } else {
      pm.eggInventory.common = Number(pm.eggInventory.common || 0) + 1;
      granted.label = 'Common Egg (Epic roll missed)';
      granted.eggTier = 'common';
      granted.epicRoll = false;
    }
    user.markModified('perkMachine');
  } else if (reward.type === 'token' && reward.tokenKey) {
    const pm = ensurePerkMachineDoc(user);
    if (!pm.tokens) pm.tokens = { battlePassXp15: 0, savvyMultiplier15: 0, paid3Spin: 0 };
    if (pm.tokens[reward.tokenKey] == null) pm.tokens[reward.tokenKey] = 0;
    pm.tokens[reward.tokenKey] = Number(pm.tokens[reward.tokenKey] || 0) + 1;
    user.markModified('perkMachine');
  } else if (reward.type === 'streak_shield') {
    if (!user.dailyStreak) user.dailyStreak = {};
    user.dailyStreak.scoutShields = Number(user.dailyStreak.scoutShields || 0) + 1;
    user.markModified('dailyStreak');
  } else if (reward.type === 'bp_xp') {
    const amount = Math.max(0, Number(reward.amount) || 0);
    await adminGrantXp(String(user._id), amount);
    granted.bpXpGranted = amount;
  } else if (reward.type === 'player_xp') {
    const amount = Math.max(0, Number(reward.amount) || 0);
    if (typeof user.awardXP === 'function') {
      await user.awardXP(amount, 'supply_drop');
    }
    granted.playerXpGranted = amount;
  } else if (reward.type === 'placeholder' && reward.placeholderKey) {
    if (!user.eventInventory || typeof user.eventInventory !== 'object') {
      user.eventInventory = {};
    }
    const key = reward.placeholderKey;
    user.eventInventory[key] = Number(user.eventInventory[key] || 0) + 1;
    user.markModified('eventInventory');
    granted.placeholderKey = key;
  } else if (reward.type === 'calling_card') {
    const pm = ensurePerkMachineDoc(user);
    pm.callingCardDrops = Number(pm.callingCardDrops || 0) + 1;
    user.markModified('perkMachine');
  }

  return granted;
}

module.exports = {
  applyEventReward,
};
