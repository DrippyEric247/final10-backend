/**
 * Canonical Savvy grants for daily-task milestones (Wave 6).
 */

const { utcDayKey } = require('../../config/savvyRewards');

async function grantDailyTaskSavvy(user, { amount, taskKey, note, rewardType = 'daily_task' }) {
  const savvy = Math.round(Number(amount) || 0);
  if (savvy <= 0 || !user?._id) return { granted: false, amount: 0 };

  const { grantSavvyReward } = require('../../services/savvyRewardService');
  return grantSavvyReward(user, {
    rewardType,
    amount: savvy,
    baseAmount: savvy,
    idempotencyKey: `${rewardType}:${user._id}:${taskKey}:${utcDayKey()}`,
    note: note || `Daily task: ${taskKey}`,
    meta: { taskKey, source: 'daily_task' },
  });
}

module.exports = { grantDailyTaskSavvy };
