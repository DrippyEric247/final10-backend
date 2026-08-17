/**
 * Easter Egg Challenge — activation, expiration, completion, claim framework.
 */
const { getEasterChallengeById } = require('../config/easterChallengeConfig');
const { grantSavvyReward } = require('./savvyRewardService');
const { REWARD_CLASS } = require('../config/savvyRewardPolicy');

function ensureEasterChallengeDoc(user) {
  if (!user.easterChallenge || typeof user.easterChallenge !== 'object') {
    user.easterChallenge = {};
  }
  const ec = user.easterChallenge;
  if (!Array.isArray(ec.completedChallengeIds)) ec.completedChallengeIds = [];
  if (!Array.isArray(ec.claimedChallengeIds)) ec.claimedChallengeIds = [];
  if (!Array.isArray(ec.activationHistory)) ec.activationHistory = [];
  return ec;
}

function readActiveChallenge(user) {
  const ec = ensureEasterChallengeDoc(user);
  if (!ec.activeChallengeId || !ec.activeChallengeExpiresAt) return null;
  const expiresAt = new Date(ec.activeChallengeExpiresAt);
  if (expiresAt.getTime() <= Date.now()) {
    return { expired: true, challengeId: ec.activeChallengeId };
  }
  return {
    expired: false,
    challengeId: ec.activeChallengeId,
    startedAt: ec.activeChallengeStartedAt,
    expiresAt,
    progress: ec.activeChallengeProgress || 0,
    target: ec.activeChallengeTarget || 0,
  };
}

function clearActiveChallenge(ec) {
  ec.activeChallengeId = null;
  ec.activeChallengeStartedAt = null;
  ec.activeChallengeExpiresAt = null;
  ec.activeChallengeProgress = 0;
  ec.activeChallengeTarget = 0;
  ec.activeChallengeObjective = null;
}

/**
 * Activate a challenge from Mythic Egg reward or admin.
 * If slot occupied: extend expiration if same challenge, else return fallback-needed state.
 */
async function activateEasterChallenge(user, challengeId, options = {}) {
  const id = String(challengeId || options.challengeId || 'wave3_placeholder').trim();
  const idempotencyKey = String(options.idempotencyKey || '').trim();
  const challenge = getEasterChallengeById(id);

  if (!challenge) {
    const err = new Error('Unknown Easter challenge.');
    err.status = 400;
    err.code = 'UNKNOWN_CHALLENGE';
    throw err;
  }

  if (challenge.adminOnly && !options.adminBypass) {
    const err = new Error('Challenge not available.');
    err.status = 403;
    err.code = 'CHALLENGE_NOT_PUBLIC';
    throw err;
  }

  const ec = ensureEasterChallengeDoc(user);

  if (idempotencyKey) {
    const prior = ec.activationHistory.find((h) => h.idempotencyKey === idempotencyKey);
    if (prior) {
      return {
        activated: false,
        duplicate: true,
        challengeId: prior.challengeId,
        expiresAt: prior.expiresAt,
      };
    }
  }

  const active = readActiveChallenge(user);
  if (active && !active.expired && active.challengeId !== id) {
    return {
      activated: false,
      slotOccupied: true,
      activeChallengeId: active.challengeId,
      expiresAt: active.expiresAt,
      fallbackRequired: true,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (Number(challenge.durationMs) || 86400000));
  const target = Number(challenge.objective?.target) || 1;

  ec.activeChallengeId = id;
  ec.activeChallengeStartedAt = now;
  ec.activeChallengeExpiresAt = expiresAt;
  ec.activeChallengeProgress = 0;
  ec.activeChallengeTarget = target;
  ec.activeChallengeObjective = challenge.objective?.type || 'generic';

  if (idempotencyKey) {
    ec.activationHistory.push({
      idempotencyKey,
      challengeId: id,
      activatedAt: now,
      expiresAt,
    });
    if (ec.activationHistory.length > 30) {
      ec.activationHistory = ec.activationHistory.slice(-30);
    }
  }

  user.markModified('easterChallenge');

  return {
    activated: true,
    duplicate: false,
    challengeId: id,
    displayName: challenge.displayName,
    expiresAt,
    target,
    adminOnly: Boolean(challenge.adminOnly),
  };
}

async function claimEasterChallengeReward(user, options = {}) {
  const ec = ensureEasterChallengeDoc(user);
  const challengeId = String(options.challengeId || ec.activeChallengeId || '').trim();
  const challenge = getEasterChallengeById(challengeId);

  if (!challenge) {
    const err = new Error('No completable challenge.');
    err.status = 400;
    err.code = 'NO_CHALLENGE';
    throw err;
  }

  const claimKey = String(options.idempotencyKey || `easter_claim:${user._id}:${challengeId}`);

  if (ec.claimedChallengeIds.includes(challengeId)) {
    return { claimed: false, duplicate: true, challengeId };
  }

  const progress = Number(ec.activeChallengeProgress) || 0;
  const target = Number(challenge.objective?.target) || 1;
  if (progress < target) {
    const err = new Error('Challenge not complete.');
    err.status = 400;
    err.code = 'INCOMPLETE';
    throw err;
  }

  const savvyAmount = Math.max(0, Number(challenge.rewards?.savvy) || 0);
  let savvyGranted = 0;

  if (savvyAmount > 0) {
    const grant = await grantSavvyReward(user, {
      rewardType: 'easter_challenge',
      amount: savvyAmount,
      baseAmount: savvyAmount,
      idempotencyKey: claimKey,
      note: `Easter challenge complete — ${challenge.displayName}`,
      meta: {
        challengeId,
        rewardClass: REWARD_CLASS.FIXED,
        multiplierEligible: false,
      },
    });
    savvyGranted = grant.amount || 0;
  }

  if (!ec.completedChallengeIds.includes(challengeId)) {
    ec.completedChallengeIds.push(challengeId);
  }
  if (!ec.claimedChallengeIds.includes(challengeId)) {
    ec.claimedChallengeIds.push(challengeId);
  }

  clearActiveChallenge(ec);
  user.markModified('easterChallenge');

  return {
    claimed: true,
    duplicate: false,
    challengeId,
    savvyGranted,
    rewards: challenge.rewards,
  };
}

function serializeEasterChallengePublic(user) {
  const ec = ensureEasterChallengeDoc(user);
  const active = readActiveChallenge(user);
  if (!active || active.expired) {
    return { active: false, visible: false };
  }

  const challenge = getEasterChallengeById(active.challengeId);
  if (!challenge || challenge.adminOnly) {
    return { active: true, visible: false, classified: true };
  }

  return {
    active: true,
    visible: true,
    challengeId: active.challengeId,
    displayName: challenge.displayName,
    progress: active.progress,
    target: active.target,
    expiresAt: active.expiresAt,
  };
}

module.exports = {
  ensureEasterChallengeDoc,
  readActiveChallenge,
  activateEasterChallenge,
  claimEasterChallengeReward,
  serializeEasterChallengePublic,
};
