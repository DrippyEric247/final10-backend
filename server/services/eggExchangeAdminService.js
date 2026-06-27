/**
 * Admin QA helpers for Egg Exchange Chamber.
 */

const { auditFireAndForget } = require('./securityAuditService');
const { ensurePerkMachineDoc, getPerkMachineStatus } = require('./perkMachineService');
const { getEggExchangeStatus } = require('./eggExchangeService');
const { emptyEggInventory } = require('../config/perkMachineRewards');

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
  user.savvyPoints = Number(user.savvyPoints || 0) + n;
  user.pointsBalance = Number(user.pointsBalance || 0) + n;
  await user.save();
  const log = logEggExchangeAdmin('grant_savvy', adminUser, { amount: n, newBalance: user.savvyPoints });
  return {
    savvyBalance: user.savvyPoints,
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
  user.savvyPoints = Math.max(Number(user.savvyPoints || 0), 2500);
  user.pointsBalance = Math.max(Number(user.pointsBalance || 0), 2500);
  user.markModified('perkMachine');
  await user.save();
  const log = logEggExchangeAdmin('preset_rare_to_epic', adminUser, {});
  return { exchangeStatus: getEggExchangeStatus(user), adminLog: log };
}

async function adminPresetEpicToLegendary(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.eggInventory.epic = 25;
  user.savvyPoints = Math.max(Number(user.savvyPoints || 0), 8000);
  user.pointsBalance = Math.max(Number(user.pointsBalance || 0), 8000);
  user.markModified('perkMachine');
  await user.save();
  const log = logEggExchangeAdmin('preset_epic_to_legendary', adminUser, {});
  return { exchangeStatus: getEggExchangeStatus(user), adminLog: log };
}

async function adminPresetLegendaryToMythic(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.eggInventory.legendary = 10;
  user.savvyPoints = Math.max(Number(user.savvyPoints || 0), 20000);
  user.pointsBalance = Math.max(Number(user.pointsBalance || 0), 20000);
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
  logEggExchangeAdmin,
};
