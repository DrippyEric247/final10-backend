/**
 * Savvy Perk Machine V1 — server-authoritative spins, rewards, inventory.
 */

const crypto = require('crypto');
const { utcDayKey } = require('../config/savvyRewards');
const { normalizeTier } = require('../config/subscriptionPlans');
const { grantSavvyReward, spendSavvyReward } = require('./savvyRewardService');
const { getSavvyMultiplier, serializeActiveBoosts } = require('./perkBoostService');
const { getActiveSavvySale, applySavvySaleToSpinCost, SAVVY_SALE_SPIN_COST } = require('./savvySaleService');
const {
  SPIN_MODES,
  SPIN_COOLDOWN_MS,
  HATCH_COOLDOWN_MS,
  MAX_HISTORY,
  getSpinConfig,
  buildWeightedPool,
  buildHatchPool,
  HATCHABLE_EGG_TIERS,
  pickWeightedReward,
  pickResultMessage,
  emptyEggInventory,
} = require('../config/perkMachineRewards');

function ensurePerkMachineDoc(user) {
  if (!user.perkMachine || typeof user.perkMachine !== 'object') {
    user.perkMachine = {};
  }
  const pm = user.perkMachine;
  if (!pm.eggInventory) pm.eggInventory = emptyEggInventory();
  if (!Array.isArray(pm.spinHistory)) pm.spinHistory = [];
  if (typeof pm.extraFreeSpins !== 'number') pm.extraFreeSpins = 0;
  if (!pm.tokens || typeof pm.tokens !== 'object') {
    pm.tokens = { battlePassXp15: 0, savvyMultiplier15: 0, paid3Spin: 0 };
  }
  if (typeof pm.tokens.paid3Spin !== 'number') pm.tokens.paid3Spin = 0;
  if (typeof pm.callingCardDrops !== 'number') pm.callingCardDrops = 0;
  if (typeof pm.scoutUpgrades !== 'number') pm.scoutUpgrades = 0;
  if (pm.eggInventory && typeof pm.eggInventory.mythic !== 'number') pm.eggInventory.mythic = 0;
  return pm;
}

function readTier(user) {
  return normalizeTier(user.subscription?.tier || user.membershipTier || 'free');
}

function formatTierLabel(tier) {
  const t = normalizeTier(tier);
  if (t === 'core' || t === 'premium') return 'Premium';
  if (t === 'pro' || t === 'elite') return 'Pro';
  return 'Free';
}

function nextFreeSpinTime(user) {
  const pm = ensurePerkMachineDoc(user);
  const today = utcDayKey();
  if (pm.lastFreeSpinDay !== today || Number(pm.extraFreeSpins) > 0) {
    return null;
  }
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return tomorrow.toISOString();
}

function canUseFreeSpin(user) {
  const pm = ensurePerkMachineDoc(user);
  const today = utcDayKey();
  if (pm.lastFreeSpinDay !== today) return true;
  if (Number(pm.extraFreeSpins) > 0) return true;
  if (Number(pm.eggInventory?.extraFreeSpin) > 0) return true;
  return false;
}

function serializeEggInventory(pm) {
  const inv = pm.eggInventory || emptyEggInventory();
  return {
    common: Number(inv.common) || 0,
    rare: Number(inv.rare) || 0,
    epic: Number(inv.epic) || 0,
    legendary: Number(inv.legendary) || 0,
    mythic: Number(inv.mythic) || 0,
    extraFreeSpin: Number(inv.extraFreeSpin) || 0,
  };
}

function serializeHistory(pm) {
  return (pm.spinHistory || [])
    .slice(-MAX_HISTORY)
    .reverse()
    .map((entry) => {
      const savvyCost = Number(entry.savvyCost) || 0;
      const originalSavvyCost =
        entry.originalSavvyCost != null ? Number(entry.originalSavvyCost) || savvyCost : savvyCost;
      const savvyWon =
        entry.savvyWon != null
          ? Number(entry.savvyWon) || 0
          : (entry.rewards || []).reduce((sum, r) => sum + (Number(r.savvyGranted) || 0), 0);
      return {
        spinId: entry.spinId,
        mode: entry.mode,
        slots: entry.slots,
        savvyCost,
        originalSavvyCost,
        savvySaleApplied: Boolean(entry.savvySaleApplied),
        savvySaleSavings: Number(entry.savvySaleSavings) || 0,
        savvyWon,
        net: savvyWon - savvyCost,
        rewards: entry.rewards,
        createdAt: entry.createdAt,
      };
    });
}

function getPerkMachineStatus(user) {
  const pm = ensurePerkMachineDoc(user);
  const tier = readTier(user);
  const today = utcDayKey();
  const freeAvailable = canUseFreeSpin(user);

  return {
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    subscriptionTier: tier,
    subscriptionLabel: formatTierLabel(tier),
    freeSpinAvailable: freeAvailable,
    freeSpinUsedToday: pm.lastFreeSpinDay === today && Number(pm.extraFreeSpins) === 0,
    nextFreeSpinAt: freeAvailable ? null : nextFreeSpinTime(user),
    extraFreeSpins: Number(pm.extraFreeSpins) || 0,
    eggInventory: serializeEggInventory(pm),
    tokens: {
      battlePassXp15: Number(pm.tokens?.battlePassXp15) || 0,
      savvyMultiplier15: Number(pm.tokens?.savvyMultiplier15) || 0,
      paid3Spin: Number(pm.tokens?.paid3Spin) || 0,
    },
    streakShields: Number(user.dailyStreak?.scoutShields) || 0,
    callingCardDrops: Number(pm.callingCardDrops) || 0,
    scoutUpgrades: Number(pm.scoutUpgrades) || 0,
    activeBoosts: serializeActiveBoosts(user),
    recentSpins: serializeHistory(pm).slice(0, 10),
    spinCosts: {
      free: getSpinConfig(SPIN_MODES.FREE),
      paid_1: getSpinConfig(SPIN_MODES.PAID_1),
      paid_2: getSpinConfig(SPIN_MODES.PAID_2),
      paid_3: getSpinConfig(SPIN_MODES.PAID_3),
    },
  };
}

async function getPerkMachineStatusWithEvents(user) {
  const status = getPerkMachineStatus(user);
  const savvySale = await getActiveSavvySale();
  const saleActive = savvySale?.active;

  if (saleActive) {
    for (const key of ['paid_1', 'paid_2', 'paid_3']) {
      const base = status.spinCosts[key]?.savvy || 0;
      status.spinCosts[key] = {
        ...status.spinCosts[key],
        savvy: SAVVY_SALE_SPIN_COST,
        originalSavvy: base,
        saleApplied: true,
      };
    }
  }

  status.savvySale = savvySale;
  return status;
}

function rewardToPayload(rewardDef) {
  return {
    id: rewardDef.id,
    type: rewardDef.type,
    label: rewardDef.label,
    icon: rewardDef.icon,
    rarity: rewardDef.rarity,
    amount: rewardDef.amount || null,
    eggTier: rewardDef.eggTier || null,
    tokenKey: rewardDef.tokenKey || null,
  };
}

async function applyReward(user, rewardDef, spinId) {
  const pm = ensurePerkMachineDoc(user);
  const payload = rewardToPayload(rewardDef);
  let granted = { ...payload, granted: true };

  if (rewardDef.type === 'savvy') {
    const baseAmount = Number(rewardDef.amount) || 0;
    // Apply an active 1.5× Savvy boost (integer result) so the win is real.
    const savvyMult = getSavvyMultiplier(user);
    const amount = Math.round(baseAmount * savvyMult);
    const result = await grantSavvyReward(user, {
      rewardType: 'perk_machine',
      amount,
      baseAmount,
      multiplier: savvyMult,
      idempotencyKey: `perk_machine:${user._id}:${spinId}:${rewardDef.id}:${amount}`,
      note: `Perk Machine — ${rewardDef.label}${savvyMult > 1 ? ' (1.5× boost)' : ''}`,
      meta: { spinId, source: 'perk_machine', multiplier: savvyMult },
    });
    granted.savvyGranted = result.amount;
    granted.savvyBoosted = savvyMult > 1;
    granted.newBalance = result.newBalance;
  } else if (rewardDef.type === 'egg') {
    const tier = rewardDef.eggTier;
    if (tier === 'extraFreeSpin') {
      pm.eggInventory.extraFreeSpin = Number(pm.eggInventory.extraFreeSpin) + 1;
      pm.extraFreeSpins = Number(pm.extraFreeSpins) + 1;
    } else if (tier && pm.eggInventory[tier] != null) {
      pm.eggInventory[tier] = Number(pm.eggInventory[tier]) + 1;
    }
  } else if (rewardDef.type === 'token' && rewardDef.tokenKey) {
    pm.tokens[rewardDef.tokenKey] = Number(pm.tokens[rewardDef.tokenKey] || 0) + 1;
  } else if (rewardDef.type === 'streak_shield') {
    if (!user.dailyStreak) user.dailyStreak = {};
    user.dailyStreak.scoutShields = Number(user.dailyStreak.scoutShields || 0) + 1;
  } else if (rewardDef.type === 'calling_card') {
    pm.callingCardDrops = Number(pm.callingCardDrops) + 1;
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.badges.includes('perk_calling_card')) {
      user.badges.push('perk_calling_card');
    }
  } else if (rewardDef.type === 'scout_upgrade') {
    pm.scoutUpgrades = Number(pm.scoutUpgrades || 0) + 1;
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.badges.includes('savvy_scout_upgrade')) {
      user.badges.push('savvy_scout_upgrade');
    }
  }

  user.markModified('perkMachine');
  if (user.dailyStreak) user.markModified('dailyStreak');
  return granted;
}

function highestRarity(rewards) {
  const order = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  let max = 'common';
  for (const r of rewards) {
    const rank = order[r.rarity] ?? 0;
    if (rank > (order[max] ?? 0)) max = r.rarity;
  }
  return max;
}

async function spinPerkMachine(user, options = {}) {
  const mode = String(options.mode || '').trim();
  const config = getSpinConfig(mode);
  if (!config) {
    const err = new Error('Invalid spin mode');
    err.status = 400;
    err.code = 'INVALID_MODE';
    throw err;
  }

  const pm = ensurePerkMachineDoc(user);
  const now = Date.now();
  const lastSpin = pm.lastSpinAt ? new Date(pm.lastSpinAt).getTime() : 0;
  if (lastSpin && now - lastSpin < SPIN_COOLDOWN_MS) {
    const err = new Error('Spin already in progress. Please wait.');
    err.status = 429;
    err.code = 'SPIN_IN_PROGRESS';
    throw err;
  }

  const tier = readTier(user);
  const today = utcDayKey();
  let savvyCost = config.savvy;
  let originalSavvyCost = config.savvy;
  let savvySaleApplied = false;
  let savvySaleSavings = 0;
  let usedPaid3Token = false;
  let usedExtraFreeSpin = false;

  const savvySale = await getActiveSavvySale();
  const saleActive = savvySale?.active;

  if (mode === SPIN_MODES.FREE) {
    if (!canUseFreeSpin(user)) {
      const err = new Error('Free spin already used today. Come back tomorrow or spend Savvy.');
      err.status = 400;
      err.code = 'FREE_SPIN_UNAVAILABLE';
      throw err;
    }
    if (pm.lastFreeSpinDay === today) {
      if (Number(pm.extraFreeSpins) > 0) {
        pm.extraFreeSpins -= 1;
        usedExtraFreeSpin = true;
      } else if (Number(pm.eggInventory?.extraFreeSpin) > 0) {
        pm.eggInventory.extraFreeSpin -= 1;
        usedExtraFreeSpin = true;
      }
    } else {
      pm.lastFreeSpinDay = today;
    }
  } else {
    const salePricing = applySavvySaleToSpinCost(config.savvy, saleActive);
    originalSavvyCost = salePricing.originalCost;
    savvyCost = salePricing.cost;
    savvySaleApplied = salePricing.saleApplied;
    savvySaleSavings = salePricing.savings;

    const pmTokens = ensurePerkMachineDoc(user).tokens || {};
    if (mode === SPIN_MODES.PAID_3 && Number(pmTokens.paid3Spin) > 0 && !options.adminBypassCost) {
      pm.tokens.paid3Spin = Number(pm.tokens.paid3Spin) - 1;
      savvyCost = 0;
      originalSavvyCost = config.savvy;
      usedPaid3Token = true;
      savvySaleApplied = false;
      savvySaleSavings = 0;
    }

    // Round before spending so balances stay integer (heals any legacy fraction).
    const balance = Math.round(Number(user.savvyPoints) || 0);
    if (!options.adminBypassCost) {
      if (savvyCost > 0 && balance < savvyCost) {
        const err = new Error(`Not enough Savvy. You need ${savvyCost} Savvy for this spin.`);
        err.status = 400;
        err.code = 'INSUFFICIENT_SAVVY';
        err.required = savvyCost;
        err.balance = balance;
        throw err;
      }
    } else {
      savvyCost = 0;
      originalSavvyCost = 0;
    }
  }

  pm.lastSpinAt = new Date();
  const spinId = crypto.randomUUID();

  if (mode !== SPIN_MODES.FREE && savvyCost > 0 && !options.adminBypassCost) {
    const spend = await spendSavvyReward(user, {
      amount: savvyCost,
      source: 'perk_machine_spin',
      idempotencyKey: `perk_spin_spend:${spinId}`,
      note: `Perk Machine spin (${mode})`,
      meta: { mode, spinId },
    });
    if (!spend.spent && !spend.duplicate) {
      const err = new Error(`Not enough Savvy. You need ${savvyCost} Savvy for this spin.`);
      err.status = 400;
      err.code = 'INSUFFICIENT_SAVVY';
      throw err;
    }
  }

  const pool = buildWeightedPool(tier, options.forceRewardId || null);
  const slots = config.slots;
  const rewards = [];

  for (let i = 0; i < slots; i += 1) {
    const forceId = i === 0 ? options.forceRewardId : null;
    const slotPool = forceId ? buildWeightedPool(tier, forceId) : pool;
    const picked = pickWeightedReward(slotPool);
    const granted = await applyReward(user, picked, `${spinId}:${i}`);
    rewards.push(granted);
  }

  const finalCost = mode === SPIN_MODES.FREE ? 0 : savvyCost;
  const savvyWon = rewards.reduce((sum, r) => sum + (Number(r.savvyGranted) || 0), 0);
  const netSavvy = savvyWon - finalCost;

  const historyEntry = {
    spinId,
    mode,
    slots,
    savvyCost: finalCost,
    originalSavvyCost: mode === SPIN_MODES.FREE ? 0 : originalSavvyCost,
    savvySaleApplied: usedPaid3Token ? false : savvySaleApplied,
    savvySaleSavings: usedPaid3Token ? 0 : savvySaleSavings,
    savvyWon,
    rewards: rewards.map((r) => ({
      id: r.id,
      label: r.label,
      rarity: r.rarity,
      type: r.type,
      savvyGranted: Number(r.savvyGranted) || 0,
    })),
    createdAt: new Date(),
  };

  pm.spinHistory.push(historyEntry);
  if (pm.spinHistory.length > MAX_HISTORY) {
    pm.spinHistory = pm.spinHistory.slice(-MAX_HISTORY);
  }

  user.markModified('perkMachine');
  await user.save();

  const topRarity = highestRarity(rewards);
  const resultMessage = pickResultMessage(topRarity);

  const eggsWon = rewards
    .filter((r) => r.type === 'egg')
    .map((r) => r.label);

  return {
    spinId,
    mode,
    slots,
    savvyCost: finalCost,
    savvyWon,
    net: netSavvy,
    summary: {
      cost: finalCost,
      savvyWon,
      net: netSavvy,
      eggs: eggsWon,
    },
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    rewards,
    resultMessage,
    topRarity,
    usedExtraFreeSpin,
    usedPaid3Token,
    savvySaleApplied: usedPaid3Token ? false : savvySaleApplied,
    savvySaleSavings: usedPaid3Token ? 0 : savvySaleSavings,
    originalSavvyCost: mode === SPIN_MODES.FREE ? 0 : originalSavvyCost,
    status: await getPerkMachineStatusWithEvents(user),
  };
}

async function hatchEgg(user, options = {}) {
  const eggTier = String(options.eggTier || '').trim();
  if (!HATCHABLE_EGG_TIERS.includes(eggTier)) {
    const err = new Error('That egg cannot be hatched.');
    err.status = 400;
    err.code = 'INVALID_EGG_TIER';
    throw err;
  }

  const pm = ensurePerkMachineDoc(user);
  const now = Date.now();
  const lastHatch = pm.lastHatchAt ? new Date(pm.lastHatchAt).getTime() : 0;
  if (lastHatch && now - lastHatch < HATCH_COOLDOWN_MS) {
    const err = new Error('Hatch already in progress. Please wait.');
    err.status = 429;
    err.code = 'HATCH_IN_PROGRESS';
    throw err;
  }

  const owned = Number(pm.eggInventory?.[eggTier]) || 0;
  if (owned < 1) {
    const err = new Error('You do not own that egg.');
    err.status = 400;
    err.code = 'NO_EGG';
    throw err;
  }

  pm.eggInventory[eggTier] = owned - 1;
  pm.lastHatchAt = new Date();

  const tier = readTier(user);
  const hatchId = crypto.randomUUID();
  const pool = buildHatchPool(eggTier, tier);
  const picked = pickWeightedReward(pool);
  const reward = await applyReward(user, picked, `hatch:${hatchId}`);

  const hatchSavvyWon = Number(reward.savvyGranted) || 0;
  const historyEntry = {
    spinId: hatchId,
    mode: `hatch_${eggTier}`,
    slots: 0,
    savvyCost: 0,
    savvyWon: hatchSavvyWon,
    rewards: [
      {
        id: reward.id,
        label: reward.label,
        rarity: reward.rarity,
        type: reward.type,
        savvyGranted: hatchSavvyWon,
      },
    ],
    createdAt: new Date(),
  };
  pm.spinHistory.push(historyEntry);
  if (pm.spinHistory.length > MAX_HISTORY) {
    pm.spinHistory = pm.spinHistory.slice(-MAX_HISTORY);
  }

  user.markModified('perkMachine');
  await user.save();

  return {
    hatchId,
    eggTier,
    reward,
    savvyWon: hatchSavvyWon,
    net: hatchSavvyWon,
    summary: {
      cost: 0,
      savvyWon: hatchSavvyWon,
      net: hatchSavvyWon,
      eggs: reward.type === 'egg' ? [reward.label] : [],
    },
    resultMessage: pickResultMessage(reward.rarity),
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    status: getPerkMachineStatus(user),
  };
}

module.exports = {
  ensurePerkMachineDoc,
  getPerkMachineStatus,
  getPerkMachineStatusWithEvents,
  spinPerkMachine,
  hatchEgg,
  canUseFreeSpin,
  serializeEggInventory,
  serializeHistory,
};
