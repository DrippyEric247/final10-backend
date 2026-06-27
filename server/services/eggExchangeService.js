/**
 * Egg Exchange Chamber — server-authoritative fusion logic.
 */

const crypto = require('crypto');
const {
  EGG_EXCHANGE_RECIPES,
  EXCHANGE_TYPES,
  EXCHANGE_COOLDOWN_MS,
  MAX_EXCHANGE_HISTORY,
  getRecipe,
} = require('../config/eggExchangeConfig');
const { ensurePerkMachineDoc, serializeEggInventory, getPerkMachineStatus } = require('./perkMachineService');
const { auditFireAndForget } = require('./securityAuditService');

class EggExchangeError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

function ensureExchangeFields(pm) {
  if (!Array.isArray(pm.eggExchangeHistory)) pm.eggExchangeHistory = [];
  return pm;
}

function buildExchangeOption(recipe, eggInventory, savvyBalance) {
  const owned = Number(eggInventory[recipe.fromTier]) || 0;
  const eggsRequired = recipe.eggsRequired;
  const savvyRequired = recipe.savvyRequired;
  const hasEggs = owned >= eggsRequired;
  const hasSavvy = savvyBalance >= savvyRequired;
  const progressEggs = Math.min(100, Math.round((owned / eggsRequired) * 100));
  const progressSavvy = Math.min(100, Math.round((savvyBalance / savvyRequired) * 100));
  const progressOverall = Math.min(progressEggs, progressSavvy);

  return {
    exchangeType: recipe.exchangeType,
    title: recipe.title,
    icon: recipe.icon,
    fromTier: recipe.fromTier,
    toTier: recipe.toTier,
    outputLabel: recipe.outputLabel,
    eggsOwned: owned,
    eggsRequired,
    savvyBalance,
    savvyRequired,
    canExchange: hasEggs && hasSavvy,
    missingEggs: Math.max(0, eggsRequired - owned),
    missingSavvy: Math.max(0, savvyRequired - savvyBalance),
    progressPercent: progressOverall,
    progressEggsPercent: progressEggs,
    progressSavvyPercent: progressSavvy,
  };
}

function getEggExchangeStatus(user) {
  const pm = ensureExchangeFields(ensurePerkMachineDoc(user));
  const eggInventory = serializeEggInventory(pm);
  const savvyBalance = Math.round(Number(user.savvyPoints) || 0);

  const exchanges = EXCHANGE_TYPES.map((type) =>
    buildExchangeOption(EGG_EXCHANGE_RECIPES[type], eggInventory, savvyBalance)
  );

  const mythicRecipe = EGG_EXCHANGE_RECIPES.legendary_to_mythic;
  const mythicFusion = buildExchangeOption(mythicRecipe, eggInventory, savvyBalance);

  const history = (pm.eggExchangeHistory || [])
    .slice(-MAX_EXCHANGE_HISTORY)
    .reverse()
    .map((entry) => ({
      exchangeId: entry.exchangeId,
      exchangeType: entry.exchangeType,
      fromTier: entry.fromTier,
      toTier: entry.toTier,
      eggsSpent: entry.eggsSpent,
      savvySpent: entry.savvySpent,
      outputLabel: entry.outputLabel,
      createdAt: entry.createdAt,
    }));

  return {
    savvyBalance,
    eggInventory,
    exchanges,
    mythicFusionProgress: {
      title: 'Mythic Fusion Progress',
      legendaryOwned: mythicFusion.eggsOwned,
      legendaryRequired: mythicFusion.eggsRequired,
      savvyBalance: mythicFusion.savvyBalance,
      savvyRequired: mythicFusion.savvyRequired,
      progressPercent: mythicFusion.progressPercent,
      canExchange: mythicFusion.canExchange,
      ctaPath: '/egg-exchange',
    },
    recentHistory: history.slice(0, 15),
  };
}

async function performEggExchange(user, exchangeType) {
  const recipe = getRecipe(exchangeType);
  if (!recipe) {
    throw new EggExchangeError(400, 'INVALID_EXCHANGE_TYPE', 'Unknown exchange type.');
  }

  const pm = ensureExchangeFields(ensurePerkMachineDoc(user));
  const now = Date.now();
  const lastExchange = pm.lastExchangeAt ? new Date(pm.lastExchangeAt).getTime() : 0;
  if (lastExchange && now - lastExchange < EXCHANGE_COOLDOWN_MS) {
    throw new EggExchangeError(429, 'EXCHANGE_IN_PROGRESS', 'Exchange already in progress. Please wait.');
  }

  const eggInventory = serializeEggInventory(pm);
  const savvyBalance = Math.round(Number(user.savvyPoints) || 0);
  const option = buildExchangeOption(recipe, eggInventory, savvyBalance);

  if (!option.canExchange) {
    if (option.missingEggs > 0) {
      throw new EggExchangeError(400, 'INSUFFICIENT_EGGS', `Need ${recipe.eggsRequired} ${recipe.fromTier} eggs. You have ${option.eggsOwned}.`, {
        missingEggs: option.missingEggs,
        eggsOwned: option.eggsOwned,
        eggsRequired: recipe.eggsRequired,
      });
    }
    throw new EggExchangeError(400, 'INSUFFICIENT_SAVVY', `Need ${recipe.savvyRequired} Savvy. You have ${savvyBalance}.`, {
      missingSavvy: option.missingSavvy,
      savvyBalance,
      savvyRequired: recipe.savvyRequired,
    });
  }

  pm.lastExchangeAt = new Date();

  const ownedFrom = Number(pm.eggInventory[recipe.fromTier]) || 0;
  if (ownedFrom < recipe.eggsRequired) {
    throw new EggExchangeError(409, 'INSUFFICIENT_EGGS', 'Egg count changed. Please refresh and try again.');
  }

  const balance = Math.round(Number(user.savvyPoints) || 0);
  if (balance < recipe.savvyRequired) {
    throw new EggExchangeError(409, 'INSUFFICIENT_SAVVY', 'Savvy balance changed. Please refresh and try again.');
  }

  pm.eggInventory[recipe.fromTier] = ownedFrom - recipe.eggsRequired;
  pm.eggInventory[recipe.toTier] = Number(pm.eggInventory[recipe.toTier] || 0) + 1;

  user.savvyPoints = balance - recipe.savvyRequired;
  user.pointsBalance = Math.max(0, Math.round(Number(user.pointsBalance || 0)) - recipe.savvyRequired);

  const exchangeId = crypto.randomUUID();
  const historyEntry = {
    exchangeId,
    exchangeType: recipe.exchangeType,
    fromTier: recipe.fromTier,
    toTier: recipe.toTier,
    eggsSpent: recipe.eggsRequired,
    savvySpent: recipe.savvyRequired,
    outputLabel: recipe.outputLabel,
    createdAt: new Date(),
  };

  pm.eggExchangeHistory.push(historyEntry);
  if (pm.eggExchangeHistory.length > MAX_EXCHANGE_HISTORY) {
    pm.eggExchangeHistory = pm.eggExchangeHistory.slice(-MAX_EXCHANGE_HISTORY);
  }

  user.markModified('perkMachine');
  await user.save();

  auditFireAndForget('EGG_EXCHANGE', {
    userId: user._id,
    meta: historyEntry,
  });

  return {
    exchangeId,
    exchangeType: recipe.exchangeType,
    message: `Fused into 1 ${recipe.outputLabel}!`,
    output: {
      tier: recipe.toTier,
      label: recipe.outputLabel,
      amount: 1,
    },
    spent: {
      eggs: { tier: recipe.fromTier, amount: recipe.eggsRequired },
      savvy: recipe.savvyRequired,
    },
    savvyBalance: Math.round(Number(user.savvyPoints) || 0),
    eggInventory: serializeEggInventory(pm),
    status: getEggExchangeStatus(user),
    perkMachine: getPerkMachineStatus(user),
  };
}

module.exports = {
  EggExchangeError,
  getEggExchangeStatus,
  performEggExchange,
  buildExchangeOption,
};
