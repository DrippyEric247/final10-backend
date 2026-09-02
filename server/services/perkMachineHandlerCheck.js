/**
 * Startup validation — every Perk Machine external grant dependency must be callable.
 */
const { REWARD_POOL } = require('../config/perkMachineRewards');
const {
  GRANT_HANDLERS,
  resolveGrantHandler,
  requireGrantSavvyReward,
  requireCreateSupplyDrop,
  requireGrantSystemCosmeticUnlock,
} = require('./perkMachineRewardGrant');

const EXTERNAL_HANDLER_CHECKS = Object.freeze([
  { key: 'grantSavvyReward', resolve: requireGrantSavvyReward },
  { key: 'createSupplyDrop', resolve: requireCreateSupplyDrop },
  { key: 'grantSystemCosmeticUnlock', resolve: requireGrantSystemCosmeticUnlock },
  {
    key: 'activateMythicSavvyMultiplier',
    resolve: () => require('./savvyMultiplierService').activateMythicSavvyMultiplier,
  },
  {
    key: 'grantFasterAlertPerk',
    resolve: () => require('./alertTimingService').grantFasterAlertPerk,
  },
  { key: 'grantEggHaul', resolve: () => require('./eggHaulService').grantEggHaul },
  {
    key: 'activateEasterChallenge',
    resolve: () => require('./easterChallengeService').activateEasterChallenge,
  },
  {
    key: 'applyBattlePassTierSkip',
    resolve: () => require('./battlePassSkipService').applyBattlePassTierSkip,
  },
]);

function checkCallable(name, fn) {
  const type = typeof fn;
  if (type !== 'function') {
    return { ok: false, name, type: type === 'undefined' ? 'undefined' : type };
  }
  return { ok: true, name, type: 'function' };
}

function verifyPerkMachineGrantHandlers({ failOnError = true } = {}) {
  const results = {};
  const broken = [];

  for (const { key, resolve } of EXTERNAL_HANDLER_CHECKS) {
    let fn;
    try {
      fn = resolve();
    } catch (err) {
      broken.push({ name: key, type: 'throw', error: err?.message || String(err) });
      results[key] = 'throw';
      continue;
    }
    const check = checkCallable(key, fn);
    results[key] = check.type;
    if (!check.ok) broken.push(check);
  }

  for (const reward of REWARD_POOL) {
    const handler = resolveGrantHandler(reward.type);
    if (!handler) {
      broken.push({ name: `pool:${reward.id}`, type: 'missing_handler', rewardType: reward.type });
    } else if (!GRANT_HANDLERS[reward.type]) {
      broken.push({ name: `pool:${reward.id}`, type: 'missing_grant_handler_map', rewardType: reward.type });
    }
  }

  const payload = {
    grantSavvyReward: results.grantSavvyReward || 'missing',
    createSupplyDrop: results.createSupplyDrop || 'missing',
    grantSystemCosmeticUnlock: results.grantSystemCosmeticUnlock || 'missing',
    activateMythicSavvyMultiplier: results.activateMythicSavvyMultiplier || 'missing',
    grantFasterAlertPerk: results.grantFasterAlertPerk || 'missing',
    grantEggHaul: results.grantEggHaul || 'missing',
    activateEasterChallenge: results.activateEasterChallenge || 'missing',
    applyBattlePassTierSkip: results.applyBattlePassTierSkip || 'missing',
    poolRewardCount: REWARD_POOL.length,
    allHandlersValid: broken.length === 0,
    broken: broken.length ? broken : undefined,
  };

  // eslint-disable-next-line no-console
  console.log('[PERK_MACHINE_HANDLER_CHECK]', JSON.stringify(payload));

  if (broken.length && failOnError) {
    const err = new Error(
      `Perk Machine grant handler check failed: ${broken.map((b) => `${b.name}=${b.type}`).join(', ')}`
    );
    err.code = 'PERK_MACHINE_HANDLER_CHECK_FAILED';
    err.details = broken;
    throw err;
  }

  return payload;
}

module.exports = {
  verifyPerkMachineGrantHandlers,
  EXTERNAL_HANDLER_CHECKS,
};
