const { getMissionById, periodKeyForMission } = require('../config/scoutMissions');
const { grantSavvyReward } = require('./savvyRewardService');
const {
  tryAcquireMissionClaim,
  releaseMissionClaim,
} = require('./scoutMissionProgressService');

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

  const claimLock = await tryAcquireMissionClaim(user._id, mission);
  if (!claimLock.ok) {
    if (claimLock.error === 'already_claimed') {
      return {
        ok: false,
        granted: false,
        alreadyClaimed: true,
        duplicate: true,
        added: 0,
        rewardSavvy: 0,
        error: 'already_claimed',
        message: 'Mission reward already claimed.',
      };
    }
    return {
      ok: false,
      granted: false,
      error: 'mission_not_complete',
      message: 'Complete this mission in the app before claiming.',
    };
  }

  const period = claimLock.periodKey;
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

  if (!grant.granted) {
    await releaseMissionClaim(user._id, mission, period);
    return {
      ok: false,
      granted: false,
      error: 'grant_failed',
      message: 'Could not grant mission reward.',
    };
  }

  await user.save();
  console.log('[scoutMission] reward granted', {
    userId: String(user._id),
    missionId: mission.id,
    rewardAmount: grant.amount,
    oldBalance,
    newBalance: grant.newBalance,
  });

  return {
    ok: true,
    granted: true,
    alreadyClaimed: false,
    duplicate: false,
    added: grant.amount,
    rewardSavvy: grant.amount,
    newBalance: grant.newBalance,
    missionId: mission.id,
    periodKey: period,
    message: `+${grant.amount} Savvy added to your wallet`,
  };
}

module.exports = { claimScoutMissionReward };
