/**
 * Community mission Savvy claims — idempotent per user/mission/period.
 */

const { grantSavvyReward } = require('./savvyRewardService');
const { findMission, periodKeyForCadence } = require('../config/communityMissions');

function ensureClaimsDoc(user) {
  if (!Array.isArray(user.communityMissionClaims)) {
    user.communityMissionClaims = [];
  }
  return user.communityMissionClaims;
}

function hasClaimed(user, missionId, periodKey) {
  return ensureClaimsDoc(user).some(
    (row) => row.missionId === missionId && row.periodKey === periodKey
  );
}

/**
 * @param {import('../models/User')} user
 * @param {{ missionId: string, periodKey?: string, idempotencyKey: string }} payload
 */
async function claimCommunityMissionReward(user, payload = {}) {
  const missionId = String(payload.missionId || '').trim();
  const idempotencyKey = String(payload.idempotencyKey || '').trim();
  const def = findMission(missionId);

  if (!def) {
    const err = new Error('Unknown mission.');
    err.status = 400;
    err.code = 'UNKNOWN_MISSION';
    throw err;
  }
  if (!idempotencyKey) {
    const err = new Error('idempotencyKey is required.');
    err.status = 400;
    err.code = 'IDEMPOTENCY_REQUIRED';
    throw err;
  }

  const periodKey = String(payload.periodKey || periodKeyForCadence(def.cadence)).trim();
  const savvyKey = `community_mission:${user._id}:${missionId}:${periodKey}`;

  if (hasClaimed(user, missionId, periodKey)) {
    return {
      ok: true,
      duplicate: true,
      alreadyClaimed: true,
      amount: 0,
      newBalance: Math.round(Number(user.savvyPoints) || 0),
      missionId,
      periodKey,
    };
  }

  const result = await grantSavvyReward(user, {
    rewardType: 'community_mission',
    amount: def.rewardSavvy,
    idempotencyKey: savvyKey,
    note: `Community mission: ${missionId}`,
    meta: { missionId, periodKey, cadence: def.cadence, clientKey: idempotencyKey },
  });

  if (result.granted || result.duplicate) {
    if (!hasClaimed(user, missionId, periodKey)) {
      ensureClaimsDoc(user).push({
        missionId,
        periodKey,
        cadence: def.cadence,
        amount: def.rewardSavvy,
        idempotencyKey: savvyKey,
        claimedAt: new Date(),
      });
      if (user.communityMissionClaims.length > 120) {
        user.communityMissionClaims = user.communityMissionClaims.slice(-120);
      }
      user.markModified('communityMissionClaims');
    }
  }

  return {
    ok: true,
    duplicate: Boolean(result.duplicate),
    alreadyClaimed: Boolean(result.duplicate),
    granted: Boolean(result.granted),
    amount: result.amount || def.rewardSavvy,
    added: result.amount || (result.duplicate ? 0 : def.rewardSavvy),
    newBalance: result.newBalance,
    missionId,
    periodKey,
  };
}

module.exports = {
  claimCommunityMissionReward,
};
