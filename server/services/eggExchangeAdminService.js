/**
 * Admin QA helpers for Egg Exchange Chamber.
 */

const crypto = require('crypto');
const { auditFireAndForget } = require('./securityAuditService');
const { ensurePerkMachineDoc, getPerkMachineStatus } = require('./perkMachineService');
const { getEggExchangeStatus } = require('./eggExchangeService');
const { emptyEggInventory } = require('../config/perkMachineRewards');
const { creditSavvy } = require('./savvyBalanceService');

function buildAdminLogEntry(action, adminUser, details = {}) {
  return {
    action,
    timestamp: new Date().toISOString(),
    adminUserId: String(adminUser._id),
    adminUsername: adminUser.username || adminUser.email || 'admin',
    details,
  };
}

function logEggExchangeAdmin(action, adminUser, details = {}) {
  const entry = buildAdminLogEntry(action, adminUser, details);
  auditFireAndForget('EGG_EXCHANGE_ADMIN_TEST', {
    userId: adminUser._id,
    meta: entry,
  });
  console.info('[eggs/exchange/admin]', entry);
  return entry;
}

async function ensureMinimumSavvy(user, target, source, idempotencyPrefix) {
  const current = Math.round(Number(user.savvyPoints) || 0);
  if (current >= target) return current;
  const credit = await creditSavvy(user, {
    amount: target - current,
    source,
    idempotencyKey: `${idempotencyPrefix}:${user._id}:${crypto.randomUUID()}`,
  });
  return credit.newBalance;
}

async function adminGrantEggsForExchange(user, tier, count, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  const n = Math.max(1, Math.min(999, Math.round(Number(count) || 1)));
  const t = String(tier || 'rare');
  if (pm.eggInventory[t] == null) {
    throw new Error(`Invalid egg tier: ${t}`);
  }
  pm.eggInventory[t] = Number(pm.eggInventory[t] || 0) + n;
  user.markModified('perkMachine');
  await user.save();
  const log = logEggExchangeAdmin(`grant_${t}_eggs`, adminUser, { tier: t, count: n });
  return { eggInventory: pm.eggInventory, exchangeStatus: getEggExchangeStatus(user), adminLog: log };
}

async function adminGrantSavvyForExchange(user, amount, adminUser) {
  const n = Math.round(Number(amount) || 0);
  const credit = await creditSavvy(user, {
    amount: n,
    source: 'admin_egg_exchange_grant',
    idempotencyKey: `admin_egg_exchange_grant:${user._id}:${crypto.randomUUID()}`,
    meta: { adminId: String(adminUser._id) },
  });
  await user.save();
  const log = logEggExchangeAdmin('grant_savvy', adminUser, { amount: n, newBalance: credit.newBalance });
  return {
    savvyBalance: credit.newBalance,
    exchangeStatus: getEggExchangeStatus(user),
    adminLog: log,
  };
}

async function adminResetExchangeInventory(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.eggInventory = emptyEggInventory();
  pm.eggExchangeHistory = [];
  pm.lastExchangeAt = null;
  user.markModified('perkMachine');
  await user.save();
  const log = logEggExchangeAdmin('reset_exchange_inventory', adminUser, {});
  return { exchangeStatus: getEggExchangeStatus(user), adminLog: log };
}

async function adminPresetRareToEpic(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.eggInventory.rare = 25;
  pm.eggInventory.epic = Number(pm.eggInventory.epic || 0);
  await ensureMinimumSavvy(user, 2500, 'admin_preset_rare_epic', 'admin_preset_rare_epic');
  user.markModified('perkMachine');
  await user.save();
  const log = logEggExchangeAdmin('preset_rare_to_epic', adminUser, {});
  return { exchangeStatus: getEggExchangeStatus(user), adminLog: log };
}

async function adminPresetEpicToLegendary(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.eggInventory.epic = 25;
  await ensureMinimumSavvy(user, 8000, 'admin_preset_epic_legendary', 'admin_preset_epic_legendary');
  user.markModified('perkMachine');
  await user.save();
  const log = logEggExchangeAdmin('preset_epic_to_legendary', adminUser, {});
  return { exchangeStatus: getEggExchangeStatus(user), adminLog: log };
}

async function adminPresetLegendaryToMythic(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.eggInventory.legendary = 10;
  await ensureMinimumSavvy(user, 20000, 'admin_preset_legendary_mythic', 'admin_preset_legendary_mythic');
  user.markModified('perkMachine');
  await user.save();
  const log = logEggExchangeAdmin('preset_legendary_to_mythic', adminUser, {});
  return { exchangeStatus: getEggExchangeStatus(user), adminLog: log };
}

module.exports = {
  adminGrantEggsForExchange,
  adminGrantSavvyForExchange,
  adminResetExchangeInventory,
  adminPresetRareToEpic,
  adminPresetEpicToLegendary,
  adminPresetLegendaryToMythic,
};
