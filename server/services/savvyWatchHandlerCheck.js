/**
 * Startup validation — Savvy Watch reward handlers and policy sources.
 */
const { SAVVY_WATCH_REWARD_SOURCES } = require('../config/savvyWatchConfig');
const { getRewardPolicy, REWARD_CLASS } = require('../config/savvyRewardPolicy');
const { requireGrantSavvyReward } = require('./savvyWatchRewardService');

function verifySavvyWatchHandlers({ failOnError = true } = {}) {
  const broken = [];
  const results = {};

  try {
    const fn = requireGrantSavvyReward();
    results.grantSavvyReward = typeof fn === 'function' ? 'function' : typeof fn;
    if (typeof fn !== 'function') broken.push({ name: 'grantSavvyReward', type: results.grantSavvyReward });
  } catch (err) {
    results.grantSavvyReward = 'throw';
    broken.push({ name: 'grantSavvyReward', type: 'throw', error: err?.message });
  }

  for (const source of SAVVY_WATCH_REWARD_SOURCES) {
    const policy = getRewardPolicy(source);
    if (!policy) {
      broken.push({ name: `policy:${source}`, type: 'missing' });
      results[`policy_${source}`] = 'missing';
    } else if (policy.rewardClass !== REWARD_CLASS.FIXED) {
      broken.push({ name: `policy:${source}`, type: 'not_fixed', rewardClass: policy.rewardClass });
      results[`policy_${source}`] = policy.rewardClass;
    } else {
      results[`policy_${source}`] = 'fixed';
    }
  }

  const payload = {
    grantSavvyReward: results.grantSavvyReward || 'missing',
    savvyWatchSources: SAVVY_WATCH_REWARD_SOURCES.length,
    allValid: broken.length === 0,
    broken: broken.length ? broken : undefined,
  };

  // eslint-disable-next-line no-console
  console.log('[SAVVY_WATCH_HANDLER_CHECK]', JSON.stringify(payload));

  if (broken.length && failOnError) {
    const err = new Error(
      `Savvy Watch handler check failed: ${broken.map((b) => `${b.name}=${b.type}`).join(', ')}`
    );
    err.code = 'SAVVY_WATCH_HANDLER_CHECK_FAILED';
    throw err;
  }

  return payload;
}

module.exports = { verifySavvyWatchHandlers };
