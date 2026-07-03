/**
 * Server-side Scout mission progress — only trusted hooks may advance progress.
 */
const ScoutMissionProgress = require('../models/ScoutMissionProgress');
const {
  getMissionsForTrigger,
  periodKeyForMission,
  getMissionById,
  cadenceKey,
} = require('../config/scoutMissions');

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
 * Record progress for all missions matching a trusted trigger.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string} trigger
 * @param {{ increment?: number }} [opts]
 */
async function recordScoutMissionTrigger(userId, trigger, opts = {}) {
  const increment = Math.max(1, Math.round(Number(opts.increment) || 1));
  const missions = getMissionsForTrigger(trigger);
  if (!missions.length) return [];

  const completed = [];

  for (const mission of missions) {
    const row = await getOrCreateProgress(userId, mission);
    if (row.completedAt) {
      completed.push({ missionId: mission.id, alreadyComplete: true });
      continue;
    }

    let nextProgress = Number(row.progress) || 0;

    if (trigger === 'create_alert' && mission.id === 'three_alerts') {
      nextProgress = Math.min(row.target, nextProgress + increment);
    } else if (trigger === 'savvy_earned_today') {
      nextProgress = Math.min(row.target, nextProgress + increment);
    } else {
      nextProgress = Math.min(row.target, nextProgress + increment);
    }

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
    completedAt: r.completedAt,
  }));
}

/**
 * Map battle pass / progression event types to scout triggers.
 */
async function recordScoutProgressFromProgressionEvent(userId, eventType) {
  const { PROGRESSION_EVENT_TO_SCOUT_TRIGGER } = require('../config/scoutMissions');
  const trigger = PROGRESSION_EVENT_TO_SCOUT_TRIGGER[eventType];
  if (!trigger) return [];
  return recordScoutMissionTrigger(userId, trigger);
}

module.exports = {
  recordScoutMissionTrigger,
  isMissionCompleteOnServer,
  getMissionProgressSnapshot,
  recordScoutProgressFromProgressionEvent,
  getOrCreateProgress,
};
