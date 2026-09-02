/**
 * Admin QA helpers for Savvy Perk Machine.
 */

const crypto = require('crypto');
const { auditFireAndForget } = require('./securityAuditService');
const { emptyEggInventory, HATCHABLE_EGG_TIERS } = require('../config/perkMachineRewards');
const { ensurePerkMachineDoc, getPerkMachineStatus, applyReward } = require('./perkMachineService');
const { REWARD_BY_ID } = require('../config/perkMachineRewards');
const {
  sanitizeRewardForGrantLog,
  resolveGrantHandler,
  validateRewardBeforeGrant,
} = require('./perkMachineRewardGrant');
const { creditSavvy } = require('./savvyBalanceService');
const {
  adminSetNukeProgress,
  adminTriggerNuke,
  adminEndNuke,
  formatNukeForClient,
} = require('./perkMachineNukeService');

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
  const runId = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const credit = await creditSavvy(user, {
    amount: n,
    source: 'admin_perk_machine_grant',
    idempotencyKey: `admin_perk_grant:${user._id}:${runId}`,
    meta: { adminId: String(adminUser._id) },
  });
  await user.save();
  const log = logAdminPerkAction('grant_savvy', adminUser, user, {
    amount: n,
    newBalance: credit.newBalance,
  });
  return { savvyBalance: credit.newBalance, adminLog: log };
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

async function adminSetNukeSpinProgress(user, count, adminUser) {
  const nuke = adminSetNukeProgress(user, count);
  await user.save();
  const log = logAdminPerkAction('nuke_set_progress', adminUser, user, { count });
  return { nuke, adminLog: log };
}

async function adminTriggerNukeEvent(user, opts = {}, adminUser) {
  const result = adminTriggerNuke(user, opts);
  await user.save();
  if (result?.thresholdReached || result?.triggered) {
    try {
      const { evaluateNukeEggKeychainGrant } = require('./eggKeychainService');
      await evaluateNukeEggKeychainGrant(user, 'nuke_event_admin_trigger');
    } catch (err) {
      console.error('[egg-keychains] nuke keychain grant failed', err?.message || err);
    }
  }
  const log = logAdminPerkAction('nuke_trigger', adminUser, user, opts);
  return { ...result, adminLog: log };
}

async function adminEndNukeEvent(user, adminUser) {
  const result = adminEndNuke(user);
  await user.save();
  const log = logAdminPerkAction('nuke_end', adminUser, user);
  return { ...result, adminLog: log };
}

async function adminGetNukeState(user) {
  return { nuke: formatNukeForClient(user) };
}

async function adminGetNukeStateForUserId(userId) {
  const User = require('../models/User');
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return { userId: String(user._id), nuke: formatNukeForClient(user) };
}

async function adminGrantRewardTest(user, rewardId, adminUser) {
  const rewardDef = REWARD_BY_ID[String(rewardId || '').trim()];
  if (!rewardDef) {
    const err = new Error(`Unknown reward id: ${rewardId}`);
    err.status = 400;
    err.code = 'INVALID_REWARD_ID';
    throw err;
  }

  validateRewardBeforeGrant(rewardDef);
  const spinId = `admin_reward_test:${crypto.randomUUID()}`;
  const savvyBefore = Math.round(Number(user.savvyPoints) || 0);
  const granted = await applyReward(user, { ...rewardDef }, spinId);
  user.markModified('perkMachine');
  await user.save();

  const log = logAdminPerkAction('grant_reward_test', adminUser, user, {
    rewardId: rewardDef.id,
    rewardType: rewardDef.type,
    handler: resolveGrantHandler(rewardDef.type),
    preview: sanitizeRewardForGrantLog(rewardDef),
  });

  return {
    granted,
    savvyBefore,
    savvyAfter: Math.round(Number(user.savvyPoints) || 0),
    status: getPerkMachineStatus(user),
    adminLog: log,
  };
}

module.exports = {
  adminResetFreeSpin,
  adminGrantSavvy,
  adminGrantEgg,
  adminClearHistory,
  adminSetNukeSpinProgress,
  adminTriggerNukeEvent,
  adminEndNukeEvent,
  adminGetNukeState,
  adminGetNukeStateForUserId,
  adminGrantRewardTest,
};
