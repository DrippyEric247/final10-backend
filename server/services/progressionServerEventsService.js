/**
 * Server-trusted Battle Pass progression events — emitted from authoritative hooks only.
 */
const crypto = require('crypto');
const User = require('../models/User');
const BattlePassProgress = require('../models/BattlePassProgress');
const { DEFAULT_BATTLE_PASS_SEASON_ID, shouldEmitBattlePassProgress } = require('../config/battlePassTrust');

/** Serialize server BP emits per user to avoid concurrent VersionError on BattlePassProgress. */
const userEmitQueues = new Map();

function enqueueUserBattlePassEmit(userId, fn) {
  if (!shouldEmitBattlePassProgress()) return Promise.resolve(null);
  const key = String(userId);
  const prev = userEmitQueues.get(key) || Promise.resolve();
  const next = prev.then(() => fn(), () => fn());
  userEmitQueues.set(
    key,
    next.finally(() => {
      if (userEmitQueues.get(key) === next) userEmitQueues.delete(key);
    })
  );
  return next;
}

function serverEventId(kind, stableKey) {
  const hash = crypto.createHash('sha256').update(`${kind}:${stableKey}`).digest('hex').slice(0, 24);
  return `srv_${kind}_${hash}`;
}

async function computeSavvyLeaderboardRank(userId) {
  const user = await User.findById(userId).select('savvyPoints').lean();
  if (!user) return null;
  const score = Number(user.savvyPoints) || 0;
  const higher = await User.countDocuments({ savvyPoints: { $gt: score } });
  return higher + 1;
}

async function ensureRankAnchor(userId) {
  const bp = await BattlePassProgress.findOne({ userId, seasonId: DEFAULT_BATTLE_PASS_SEASON_ID });
  if (!bp) return null;
  const rank = await computeSavvyLeaderboardRank(userId);
  if (rank == null) return bp;
  const patch = {};
  if (bp.seasonRankAnchor == null) patch.seasonRankAnchor = rank;
  if (bp.lastKnownLeaderboardRank == null) patch.lastKnownLeaderboardRank = rank;
  if (Object.keys(patch).length) {
    await BattlePassProgress.updateOne({ _id: bp._id }, { $set: patch });
  }
  return BattlePassProgress.findById(bp._id).lean();
}

async function maybeEmitRankProgress(userId, stableKeyPrefix) {
  const bp = await ensureRankAnchor(userId);
  if (!bp) return null;

  const newRank = await computeSavvyLeaderboardRank(userId);
  if (newRank == null) return null;

  const prev = bp.lastKnownLeaderboardRank;
  if (prev == null || newRank === prev) {
    if (prev == null) {
      await BattlePassProgress.updateOne(
        { _id: bp._id },
        { $set: { lastKnownLeaderboardRank: newRank } }
      );
    }
    return null;
  }

  await BattlePassProgress.updateOne(
    { _id: bp._id },
    { $set: { lastKnownLeaderboardRank: newRank } }
  );

  if (newRank >= prev) return null;

  return emitServerBattlePassEventInner(
    userId,
    'rank_changed',
    { previousRank: prev, newRank },
    `${stableKeyPrefix}:rank:${prev}->${newRank}`
  );
}

async function emitServerBattlePassEventInner(userId, type, payload, stableKey) {
  const { processBattlePassEvent } = require('./battlePassPersistenceService');
  const event = {
    id: serverEventId(type, stableKey),
    type,
    timestamp: Date.now(),
    payload,
  };
  return processBattlePassEvent(userId, DEFAULT_BATTLE_PASS_SEASON_ID, event, {
    trustedServerOrigin: true,
  });
}

async function emitServerBattlePassEvent(userId, type, payload, stableKey) {
  return enqueueUserBattlePassEmit(userId, () =>
    emitServerBattlePassEventInner(userId, type, payload, stableKey)
  );
}

async function onSavvyCreditedForBattlePass(userId, amount, source, idempotencyKey) {
  return enqueueUserBattlePassEmit(userId, async () => {
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (amt <= 0) return null;

    const key = idempotencyKey || `savvy:${userId}:${amt}:${Date.now()}`;
    const src = String(source || 'savvy_credit').slice(0, 120);

    await emitServerBattlePassEventInner(
      userId,
      'savvy_points_earned',
      { amount: amt, source: src },
      key
    );

    return maybeEmitRankProgress(userId, key);
  });
}

async function onDailyStreakClaimedForBattlePass(userId, streakDay, dayKey) {
  return enqueueUserBattlePassEmit(userId, async () => {
    const stable = `streak:${userId}:${dayKey}`;
    await emitServerBattlePassEventInner(
      userId,
      'daily_login_claimed',
      { streakDay: Math.max(1, Number(streakDay) || 1), rewardClaimed: true },
      `${stable}:login`
    );
    return emitServerBattlePassEventInner(
      userId,
      'streak_updated',
      { streakType: 'login', days: Math.max(0, Number(streakDay) || 0) },
      `${stable}:streak`
    );
  });
}

async function onPowerMultiplierChangedForBattlePass(userId, previousMultiplier, newMultiplier, stableKey) {
  const prev = Number(previousMultiplier) || 1;
  const next = Number(newMultiplier) || 1;
  if (Math.abs(prev - next) < 1e-9) return null;
  return enqueueUserBattlePassEmit(userId, () =>
    emitServerBattlePassEventInner(
      userId,
      'power_multiplier_changed',
      { previousMultiplier: prev, newMultiplier: next },
      stableKey || `pm:${userId}:${prev}->${next}`
    )
  );
}

module.exports = {
  serverEventId,
  computeSavvyLeaderboardRank,
  ensureRankAnchor,
  emitServerBattlePassEvent,
  onSavvyCreditedForBattlePass,
  onDailyStreakClaimedForBattlePass,
  onPowerMultiplierChangedForBattlePass,
  maybeEmitRankProgress,
};
