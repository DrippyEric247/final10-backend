/**
 * Server-side Scout mission progress — only trusted hooks may advance progress.
 */
const ScoutMissionProgress = require('../models/ScoutMissionProgress');
const User = require('../models/User');
const {
  getMissionsForTrigger,
  periodKeyForMission,
} = require('../config/scoutMissions');
const {
  isClientObservableTrigger,
  isServerVerifiableTrigger,
  clientObservableDailyCap,
} = require('../config/scoutMissionTriggers');

const MAX_DEDUPE_KEYS = 400;

function todayKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

async function consumeDedupeKey(userId, dedupeKey) {
  const key = String(dedupeKey || '').trim();
  if (!key) return { duplicate: false };

  const user = await User.findById(userId).select('scoutActionDedupe').lean();
  const existing = Array.isArray(user?.scoutActionDedupe?.keys) ? user.scoutActionDedupe.keys : [];
  if (existing.includes(key)) {
    return { duplicate: true };
  }

  const nextKeys = [...existing, key].slice(-MAX_DEDUPE_KEYS);
  await User.updateOne({ _id: userId }, { $set: { 'scoutActionDedupe.keys': nextKeys } });
  return { duplicate: false };
}

async function getOrCreateProgress(userId, mission) {
  const periodKey = periodKeyForMission(mission);
  const target = Math.max(1, Math.round(Number(mission.target) || 1));

  let row = await ScoutMissionProgress.findOne({ userId, missionId: mission.id, periodKey });
  if (!row) {
    try {
      row = await ScoutMissionProgress.create({
        userId,
        missionId: mission.id,
        periodKey,
        progress: 0,
        target,
      });
    } catch (e) {
      if (e?.code === 11000) {
        row = await ScoutMissionProgress.findOne({ userId, missionId: mission.id, periodKey });
      } else {
        throw e;
      }
    }
  }
  return row;
}

/**
 * Enforce client-observable rate limits and idempotency for record-action.
 * @returns {{ duplicate?: boolean }}
 */
async function enforceClientActionPolicy(userId, trigger, opts = {}) {
  if (opts.source !== 'client') return {};

  if (opts.warnServerVerifiableFromClient && isServerVerifiableTrigger(trigger)) {
    try {
      const { auditFireAndForget } = require('./securityAuditService');
      auditFireAndForget('SCOUT_CLIENT_SERVER_VERIFIABLE', {
        userId,
        meta: { trigger, idempotencyKey: opts.idempotencyKey || null },
        severity: 'info',
      });
    } catch {
      /* ignore audit failures */
    }
  }

  if (!isClientObservableTrigger(trigger)) {
    return {};
  }

  const day = todayKey();
  const cap = clientObservableDailyCap(trigger);
  const user = await User.findById(userId).lean();
  const daily = user?.scoutClientActionDaily || {};
  const sameDay = daily.day === day;
  const counts = sameDay && daily.counts && typeof daily.counts === 'object' ? { ...daily.counts } : {};
  const keys = sameDay && Array.isArray(daily.idempotencyKeys) ? [...daily.idempotencyKeys] : [];

  if (opts.idempotencyKey && keys.includes(opts.idempotencyKey)) {
    return { duplicate: true };
  }

  const used = Math.max(0, Number(counts[trigger]) || 0);
  if (used >= cap) {
    const err = new Error('Daily scout client action limit reached.');
    err.code = 'SCOUT_ACTION_RATE_LIMIT';
    throw err;
  }

  counts[trigger] = used + 1;
  const nextKeys = opts.idempotencyKey ? [...keys.slice(-49), opts.idempotencyKey] : keys;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        scoutClientActionDaily: {
          day,
          counts,
          idempotencyKeys: nextKeys,
        },
      },
    }
  );

  return {};
}

/**
 * Record progress for all missions matching a trusted trigger.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} trigger
 * @param {{ increment?: number, source?: string, idempotencyKey?: string|null, allowClientObservable?: boolean, warnServerVerifiableFromClient?: boolean, dedupeKey?: string|null }} [opts]
 */
async function recordScoutMissionTrigger(userId, trigger, opts = {}) {
  const increment = Math.max(1, Math.round(Number(opts.increment) || 1));
  const missions = getMissionsForTrigger(trigger);
  if (!missions.length) return [];

  if (opts.dedupeKey) {
    const dedupe = await consumeDedupeKey(userId, opts.dedupeKey);
    if (dedupe.duplicate) return [];
  }

  const policy = await enforceClientActionPolicy(userId, trigger, opts);
  if (policy.duplicate) return [];

  const completed = [];

  for (const mission of missions) {
    const row = await getOrCreateProgress(userId, mission);
    if (row.completedAt) {
      completed.push({ missionId: mission.id, alreadyComplete: true });
      continue;
    }

    let nextProgress = Number(row.progress) || 0;
    nextProgress = Math.min(row.target, nextProgress + increment);

    const patch = {
      progress: nextProgress,
      lastTrigger: trigger,
    };
    if (nextProgress >= row.target && !row.completedAt) {
      patch.completedAt = new Date();
    }

    await ScoutMissionProgress.updateOne({ _id: row._id }, { $set: patch });

    if (patch.completedAt) {
      completed.push({ missionId: mission.id, completed: true, progress: nextProgress });
    }
  }

  try {
    const { auditFireAndForget } = require('./securityAuditService');
    auditFireAndForget('SCOUT_ACTION_RECORDED', {
      userId,
      meta: {
        trigger,
        source: opts.source || 'server',
        increment,
        completedCount: completed.length,
        idempotencyKey: opts.idempotencyKey || null,
      },
      severity: 'info',
    });
  } catch {
    /* ignore */
  }

  return completed;
}

/**
 * Verify server-side mission completion before granting Savvy.
 */
async function isMissionCompleteOnServer(userId, mission) {
  const periodKey = periodKeyForMission(mission);
  const row = await ScoutMissionProgress.findOne({
    userId,
    missionId: mission.id,
    periodKey,
  }).lean();

  if (!row) return false;
  if (row.completedAt) return true;
  return Number(row.progress) >= Number(row.target);
}

async function getMissionProgressSnapshot(userId) {
  const rows = await ScoutMissionProgress.find({ userId }).sort({ updatedAt: -1 }).lean();
  return rows.map((r) => ({
    missionId: r.missionId,
    periodKey: r.periodKey,
    progress: r.progress,
    target: r.target,
    complete: Boolean(r.completedAt) || Number(r.progress) >= Number(r.target),
    claimed: Boolean(r.claimedAt),
    completedAt: r.completedAt,
    claimedAt: r.claimedAt,
  }));
}

/**
 * Atomically reserve a mission claim slot (one grant per user + mission + period).
 * @returns {{ ok: true, periodKey: string } | { ok: false, error: string }}
 */
async function tryAcquireMissionClaim(userId, mission) {
  const periodKey = periodKeyForMission(mission);

  const row = await ScoutMissionProgress.findOneAndUpdate(
    {
      userId,
      missionId: mission.id,
      periodKey,
      claimedAt: null,
      completedAt: { $ne: null },
    },
    { $set: { claimedAt: new Date() } },
    { new: true }
  );

  if (row) {
    return { ok: true, periodKey };
  }

  const existing = await ScoutMissionProgress.findOne({
    userId,
    missionId: mission.id,
    periodKey,
  }).lean();

  if (existing?.claimedAt) {
    return { ok: false, error: 'already_claimed' };
  }

  return { ok: false, error: 'mission_not_complete' };
}

async function releaseMissionClaim(userId, mission, periodKey) {
  await ScoutMissionProgress.updateOne(
    { userId, missionId: mission.id, periodKey, claimedAt: { $ne: null } },
    { $unset: { claimedAt: 1 } }
  );
}

/**
 * Map battle pass / progression event types to scout triggers.
 */
async function recordScoutProgressFromProgressionEvent(userId, eventType, eventId = null) {
  const { PROGRESSION_EVENT_TO_SCOUT_TRIGGER } = require('../config/scoutMissions');
  const trigger = PROGRESSION_EVENT_TO_SCOUT_TRIGGER[eventType];
  if (!trigger) return [];
  const dedupeKey = eventId
    ? `${trigger}:${String(eventId)}`
    : `${trigger}:${todayKey()}:${String(userId)}`;
  return recordScoutMissionTrigger(userId, trigger, { source: 'server', dedupeKey });
}

module.exports = {
  recordScoutMissionTrigger,
  isMissionCompleteOnServer,
  getMissionProgressSnapshot,
  recordScoutProgressFromProgressionEvent,
  getOrCreateProgress,
  tryAcquireMissionClaim,
  releaseMissionClaim,
};
