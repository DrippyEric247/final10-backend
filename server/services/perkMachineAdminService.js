/**
 * Admin QA helpers for Savvy Perk Machine.
 */

const { auditFireAndForget } = require('./securityAuditService');
const { emptyEggInventory, HATCHABLE_EGG_TIERS } = require('../config/perkMachineRewards');
const { ensurePerkMachineDoc, getPerkMachineStatus } = require('./perkMachineService');

function buildAdminLogEntry(action, adminUser, targetUser, details = {}) {
  return {
    action,
    timestamp: new Date().toISOString(),
    adminUserId: String(adminUser._id),
    adminUsername: adminUser.username || adminUser.email || 'admin',
    targetUserId: String(targetUser._id),
    targetUsername: targetUser.username || targetUser.email || 'user',
    details,
  };
}

function logAdminPerkAction(action, adminUser, targetUser, details = {}) {
  const entry = buildAdminLogEntry(action, adminUser, targetUser, details);
  auditFireAndForget('PERK_MACHINE_ADMIN_TEST', {
    userId: adminUser._id,
    meta: entry,
  });
  console.info('[perk-machine/admin/test]', entry);
  return entry;
}

async function adminResetFreeSpin(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.lastFreeSpinDay = null;
  pm.extraFreeSpins = Math.max(1, Number(pm.extraFreeSpins) || 0);
  user.markModified('perkMachine');
  await user.save();
  const log = logAdminPerkAction('reset_free_spin', adminUser, user, {
    after: getPerkMachineStatus(user),
  });
  return { status: getPerkMachineStatus(user), adminLog: log };
}

async function adminGrantSavvy(user, amount = 500, adminUser) {
  const n = Math.round(Number(amount) || 0);
  user.savvyPoints = Number(user.savvyPoints || 0) + n;
  user.pointsBalance = Number(user.pointsBalance || 0) + n;
  await user.save();
  const log = logAdminPerkAction('grant_savvy', adminUser, user, {
    amount: n,
    newBalance: user.savvyPoints,
  });
  return { savvyBalance: user.savvyPoints, adminLog: log };
}

async function adminGrantEgg(user, tier = 'rare', count = 1, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  const eggTier = HATCHABLE_EGG_TIERS.includes(String(tier)) ? String(tier) : 'rare';
  const n = Math.max(1, Math.min(99, Math.round(Number(count) || 1)));
  pm.eggInventory[eggTier] = Number(pm.eggInventory[eggTier] || 0) + n;
  user.markModified('perkMachine');
  await user.save();
  const log = logAdminPerkAction('grant_egg', adminUser, user, { eggTier, count: n });
  return { status: getPerkMachineStatus(user), adminLog: log };
}

async function adminClearHistory(user, adminUser) {
  const pm = ensurePerkMachineDoc(user);
  pm.spinHistory = [];
  pm.lastSpinAt = null;
  user.markModified('perkMachine');
  await user.save();
  const log = logAdminPerkAction('clear_history', adminUser, user);
  return { status: getPerkMachineStatus(user), adminLog: log };
}

module.exports = {
  adminResetFreeSpin,
  adminGrantSavvy,
  adminGrantEgg,
  adminClearHistory,
};
