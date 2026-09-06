/**
 * Startup validation — Savvy Core V1 handlers and policy.
 */
const { REWARD_FAMILIES } = require('./savvyCoreRewardService');
const { requireGrantSavvyReward, requireSpendSavvyReward } = require('./savvyCoreWalletService');
const { getRewardPolicy, REWARD_CLASS } = require('../../config/savvyRewardPolicy');
const { listRegisteredApps } = require('../../config/savvyCoreConfig');

const SAVVY_CORE_REWARD_SOURCES = Object.freeze([
  'savvy_core_earn',
  'savvy_core_spend',
]);

function verifySavvyCoreHandlers({ failOnError = true } = {}) {
  const broken = [];
  const results = { rewardFamilies: REWARD_FAMILIES.length, registeredApps: listRegisteredApps().length };

  try {
    results.grantSavvyReward = typeof requireGrantSavvyReward() === 'function' ? 'function' : 'missing';
    if (results.grantSavvyReward !== 'function') broken.push({ name: 'grantSavvyReward', type: results.grantSavvyReward });
  } catch (err) {
    results.grantSavvyReward = 'throw';
    broken.push({ name: 'grantSavvyReward', type: 'throw', error: err?.message });
  }

  try {
    results.spendSavvyReward = typeof requireSpendSavvyReward() === 'function' ? 'function' : 'missing';
    if (results.spendSavvyReward !== 'function') broken.push({ name: 'spendSavvyReward', type: results.spendSavvyReward });
  } catch (err) {
    results.spendSavvyReward = 'throw';
    broken.push({ name: 'spendSavvyReward', type: 'throw', error: err?.message });
  }

  for (const source of SAVVY_CORE_REWARD_SOURCES) {
    const policy = getRewardPolicy(source);
    if (!policy || policy.rewardClass !== REWARD_CLASS.FIXED) {
      broken.push({ name: `policy:${source}`, type: policy?.rewardClass || 'missing' });
      results[`policy_${source}`] = policy?.rewardClass || 'missing';
    } else {
      results[`policy_${source}`] = 'fixed';
    }
  }

  const payload = {
    ...results,
    allValid: broken.length === 0,
    broken: broken.length ? broken : undefined,
  };

  // eslint-disable-next-line no-console
  console.log('[SAVVY_CORE_HANDLER_CHECK]', JSON.stringify(payload));

  if (broken.length && failOnError) {
    const err = new Error(`Savvy Core handler check failed: ${broken.map((b) => `${b.name}=${b.type}`).join(', ')}`);
    err.code = 'SAVVY_CORE_HANDLER_CHECK_FAILED';
    throw err;
  }

  return payload;
}

module.exports = { verifySavvyCoreHandlers, SAVVY_CORE_REWARD_SOURCES };
