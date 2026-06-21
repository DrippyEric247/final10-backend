const { getMissionById, periodKeyForMission } = require('../config/scoutMissions');
const { grantSavvyReward } = require('./savvyRewardService');

/**
 * Grant Savvy for a completed Scout mission claim. Idempotent per user + mission + period.
 */
async function claimScoutMissionReward(user, { missionId, periodKey }) {
  const mission = getMissionById(missionId);
  if (!mission) {
    return {
      ok: false,
      granted: false,
      error: 'invalid_mission',
      message: 'Unknown mission.',
    };
  }

  const period = periodKeyForMission(mission, periodKey);
  const idempotencyKey = `scout_mission:${user._id}:${mission.id}:${period}`;
  const oldBalance = Math.max(0, Math.round(Number(user.savvyPoints) || 0));
  const rewardAmount = Math.max(1, Math.round(Number(mission.rewardSavvy) || 0));

  const grant = await grantSavvyReward(user, {
    rewardType: 'scout_mission',
    amount: rewardAmount,
    idempotencyKey,
    note: `Scout mission: ${mission.title}`,
    meta: { missionId: mission.id, periodKey: period, cadence: mission.cadence },
  });

  if (grant.duplicate) {
    console.log('[scoutMission] duplicate claim skipped', {
      userId: String(user._id),
      missionId: mission.id,
      rewardAmount,
      oldBalance,
      newBalance: grant.newBalance,
    });
    return {
      ok: false,
      granted: false,
      alreadyClaimed: true,
      duplicate: true,
      added: 0,
      rewardSavvy: 0,
      newBalance: grant.newBalance,
      message: 'Mission reward already claimed.',
    };
  }

  if (grant.granted) {
    await user.save();
    console.log('[scoutMission] reward granted', {
      userId: String(user._id),
      missionId: mission.id,
      rewardAmount: grant.amount,
      oldBalance,
      newBalance: grant.newBalance,
    });
  }

  return {
    ok: grant.granted,
    granted: grant.granted,
    alreadyClaimed: false,
    duplicate: false,
    added: grant.amount,
    rewardSavvy: grant.amount,
    newBalance: grant.newBalance,
    missionId: mission.id,
    periodKey: period,
    message: grant.granted
      ? `+${grant.amount} Savvy added to your wallet`
      : 'No reward granted.',
  };
}

module.exports = { claimScoutMissionReward };
