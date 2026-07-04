const Alert = require('../models/Alert');
const FoundingTesterProgress = require('../models/FoundingTesterProgress');
const User = require('../models/User');
const {
  MISSIONS,
  MISSION_COUNT,
  FEEDBACK_MIN_CHARS,
  GRAND_REWARD,
  utcDayKey,
  msUntilNextUtcDay,
  getMissionById,
} = require('../config/foundingTesterMissions');
const { grantSavvyReward } = require('./savvyRewardService');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');
const { isBetaMode } = require('../config/betaMode');
const {
  grantFoundingLegacyRewards,
  syncSlotProgress,
  getLegacyForUser,
} = require('./foundingBetaService');

async function getOrCreateProgress(userId) {
  let row = await FoundingTesterProgress.findOne({ userId });
  if (!row) {
    try {
      row = await FoundingTesterProgress.create({ userId, missionRecords: [] });
    } catch (e) {
      if (e?.code === 11000) {
        row = await FoundingTesterProgress.findOne({ userId });
      } else {
        throw e;
      }
    }
  }
  return row;
}

function recordMap(progress) {
  const map = new Map();
  for (const r of progress.missionRecords || []) {
    map.set(r.missionId, r);
  }
  return map;
}

function completedRecords(progress) {
  return (progress.missionRecords || []).filter((r) => r.completedAt);
}

async function verifyTaskSignal(user, mission) {
  switch (mission.taskType) {
    case 'search': {
      const searches = Number(user.searchUsage?.searchesToday) || 0;
      const lifetime = Number(user.searchUsage?.totalSearches) || 0;
      return searches >= 1 || lifetime >= 1;
    }
    case 'alerts': {
      const count = await Alert.countDocuments({ userId: user._id });
      return count >= 1;
    }
    case 'best_move':
    case 'profile':
    case 'events':
    case 'overall':
      return true;
    case 'perk_machine': {
      const history = Array.isArray(user.perkMachine?.spinHistory) ? user.perkMachine.spinHistory.length : 0;
      return history >= 1 || Boolean(user.perkMachine?.lastSpinAt);
    }
    default:
      return false;
  }
}

function resolveUnlockState(progress, now = new Date()) {
  const records = recordMap(progress);
  const done = completedRecords(progress);
  const completedCount = done.length;
  const completedIds = new Set(done.map((r) => r.missionId));
  const today = utcDayKey(now);
  const completedToday = done.some((r) => r.completionDayKey === today);

  if (completedCount >= MISSION_COUNT) {
    return {
      allComplete: true,
      completedCount,
      activeMissionId: null,
      activeMission: null,
      locked: false,
      lockedReason: null,
      nextUnlockMs: 0,
      nextUnlockLabel: null,
      canCompleteToday: false,
    };
  }

  const activeMission = MISSIONS.find((m) => !completedIds.has(m.id));
  if (!activeMission) {
    return {
      allComplete: true,
      completedCount,
      activeMissionId: null,
      activeMission: null,
      locked: false,
      lockedReason: null,
      nextUnlockMs: 0,
      nextUnlockLabel: null,
      canCompleteToday: false,
    };
  }

  let locked = false;
  let lockedReason = null;
  let nextUnlockMs = 0;
  let nextUnlockLabel = null;

  if (activeMission.order > 1) {
    const prev = MISSIONS.find((m) => m.order === activeMission.order - 1);
    if (!prev || !completedIds.has(prev.id)) {
      locked = true;
      lockedReason = 'previous_incomplete';
    }
  }

  if (!locked && completedCount > 0) {
    const lastDone = [...done].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
    const lastDay = lastDone?.completionDayKey || utcDayKey(new Date(lastDone?.completedAt));
    if (lastDay === today) {
      locked = true;
      lockedReason = 'next_day';
      nextUnlockMs = msUntilNextUtcDay(now);
      nextUnlockLabel = 'Next Mission Unlocks In';
    }
  }

  return {
    allComplete: false,
    completedCount,
    activeMissionId: activeMission.id,
    activeMission,
    locked,
    lockedReason,
    nextUnlockMs,
    nextUnlockLabel: locked ? nextUnlockLabel || 'Mission Available Tomorrow' : null,
    canCompleteToday: !locked && !completedToday,
  };
}

function formatCountdown(ms) {
  const totalMin = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function buildMissionView(mission, record, unlock) {
  const isActive = unlock.activeMissionId === mission.id;
  const completed = Boolean(record?.completedAt);
  const taskReady = Boolean(record?.taskAttestedAt) || Boolean(record?.taskVerified);
  const waiting = isActive && unlock.locked;
  const upcoming = !completed && mission.order > (unlock.activeMission?.order || MISSION_COUNT);

  let status = 'locked';
  if (completed) status = 'completed';
  else if (waiting) status = 'waiting';
  else if (isActive) status = 'active';
  else if (upcoming) status = 'upcoming';

  return {
    id: mission.id,
    order: mission.order,
    emoji: mission.emoji,
    title: mission.title,
    taskLabel: mission.taskLabel,
    taskDescription: mission.taskDescription,
    path: mission.path,
    questions: mission.questions,
    rewards: {
      savvy: mission.savvyReward,
      xp: mission.xpReward,
    },
    status: status,
    taskReady,
    taskAttestedAt: record?.taskAttestedAt || null,
    taskVerified: Boolean(record?.taskVerified),
    feedback: completed ? record?.feedback || '' : '',
    completedAt: record?.completedAt || null,
    savvyGranted: record?.savvyGranted || 0,
    xpGranted: record?.xpGranted || 0,
  };
}

async function getProgressSnapshot(user) {
  const progress = await getOrCreateProgress(user._id);
  const unlock = resolveUnlockState(progress);
  const records = recordMap(progress);
  const missions = MISSIONS.map((m) => buildMissionView(m, records.get(m.id), unlock));

  const remainingMissions = MISSION_COUNT - unlock.completedCount;
  const estCompletionDate = new Date();
  estCompletionDate.setUTCDate(estCompletionDate.getUTCDate() + Math.max(0, remainingMissions - (unlock.canCompleteToday ? 0 : 1)));

  const feedbackHistory = completedRecords(progress)
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt))
    .map((r) => {
      const mission = getMissionById(r.missionId);
      return {
        missionId: r.missionId,
        title: mission?.title || r.missionId,
        feedback: r.feedback,
        completedAt: r.completedAt,
      };
    });

  const legacy = await getLegacyForUser(user._id);

  return {
    ok: true,
    startedAt: progress.startedAt,
    completedCount: unlock.completedCount,
    missionCount: MISSION_COUNT,
    progressPct: Math.round((unlock.completedCount / MISSION_COUNT) * 100),
    allComplete: unlock.allComplete,
    programCompletedAt: progress.programCompletedAt,
    grandRewardGranted: Boolean(progress.grandRewardGrantedAt),
    activeMissionId: unlock.activeMissionId,
    locked: unlock.locked,
    lockedReason: unlock.lockedReason,
    nextUnlockMs: unlock.nextUnlockMs,
    nextUnlockLabel: unlock.nextUnlockLabel,
    nextUnlockCountdown: unlock.nextUnlockMs > 0 ? formatCountdown(unlock.nextUnlockMs) : null,
    canCompleteToday: unlock.canCompleteToday,
    daysRemaining: remainingMissions,
    estimatedCompletionDate: estCompletionDate.toISOString(),
    feedbackMinChars: FEEDBACK_MIN_CHARS,
    missions,
    feedbackHistory,
    grandReward: GRAND_REWARD,
    legacy,
  };
}

async function attestTask(user, missionId) {
  if (!isBetaMode()) {
    return { ok: false, code: 'BETA_INACTIVE', message: 'Founding Tester missions are beta-only.' };
  }
  if (!user?.hasFoundingTesterAccess?.()) {
    return { ok: false, code: 'NO_ACCESS', message: 'Founding Tester access required.' };
  }

  const mission = getMissionById(missionId);
  if (!mission) return { ok: false, code: 'INVALID_MISSION', message: 'Unknown mission.' };

  const progress = await getOrCreateProgress(user._id);
  const unlock = resolveUnlockState(progress);
  const records = recordMap(progress);
  const existing = records.get(missionId);

  if (existing?.completedAt) {
    return { ok: false, code: 'ALREADY_COMPLETE', message: 'Mission already completed.' };
  }
  if (unlock.activeMissionId !== missionId) {
    return { ok: false, code: 'NOT_UNLOCKED', message: 'This mission is not available yet.' };
  }
  if (unlock.locked) {
    return {
      ok: false,
      code: 'DAY_LOCKED',
      message: unlock.lockedReason === 'next_day' ? 'Next mission unlocks tomorrow.' : 'Complete the previous mission first.',
      nextUnlockMs: unlock.nextUnlockMs,
    };
  }

  const verified = await verifyTaskSignal(user, mission);
  const nextRecords = [...(progress.missionRecords || [])];
  const idx = nextRecords.findIndex((r) => r.missionId === missionId);
  const patch = {
    missionId,
    taskAttestedAt: new Date(),
    taskVerified: verified,
  };
  if (idx >= 0) nextRecords[idx] = { ...nextRecords[idx], ...patch };
  else nextRecords.push(patch);

  progress.missionRecords = nextRecords;
  await progress.save();

  return { ok: true, taskVerified: verified, message: verified ? 'Task verified.' : 'Task marked — submit feedback to finish.' };
}

async function grantGrandReward(user, progress) {
  if (progress.grandRewardGrantedAt) {
    return { granted: false, duplicate: true };
  }

  const userId = user._id;
  const savvyKey = `founding_tester_grand:${userId}`;
  await grantSavvyReward(user, {
    rewardType: 'founding_tester_grand',
    amount: GRAND_REWARD.savvy,
    idempotencyKey: savvyKey,
    note: GRAND_REWARD.title,
    meta: { program: 'founding_tester_v2' },
  });

  await user.awardXP(250, 'founding_tester_grand');

  const proEnd = new Date();
  proEnd.setUTCDate(proEnd.getUTCDate() + GRAND_REWARD.proDays);
  const currentEnd = user.subscriptionExpires ? new Date(user.subscriptionExpires) : null;
  const hasBetter =
    user.membershipTier === 'pro' && currentEnd && currentEnd > proEnd;
  if (!hasBetter) {
    user.membershipTier = 'pro';
    user.premiumTier = 'pro';
    user.isPremium = true;
    user.subscriptionExpires = proEnd;
  }

  if (!Array.isArray(user.badges)) user.badges = [];
  if (!user.badges.includes(GRAND_REWARD.badge)) user.badges.push(GRAND_REWARD.badge);

  await grantSystemCosmeticUnlock(userId, GRAND_REWARD.emblemId, 'founding_tester');
  await grantSystemCosmeticUnlock(userId, GRAND_REWARD.callingCardId, 'founding_tester');

  const legacy = await grantFoundingLegacyRewards(user);

  user.foundingTesterProgramCompleted = true;
  await user.save();

  progress.grandRewardGrantedAt = new Date();
  progress.programCompletedAt = new Date();
  await progress.save();
  await syncSlotProgress(userId);

  return {
    granted: true,
    savvy: GRAND_REWARD.savvy,
    proDays: GRAND_REWARD.proDays,
    legacy,
    welcomeLine: GRAND_REWARD.welcomeLine,
  };
}

async function completeMission(user, { missionId, feedback }) {
  if (!isBetaMode()) {
    return { ok: false, code: 'BETA_INACTIVE', message: 'Founding Tester missions are beta-only.' };
  }
  if (!user?.hasFoundingTesterAccess?.()) {
    return { ok: false, code: 'NO_ACCESS', message: 'Founding Tester access required.' };
  }

  const mission = getMissionById(missionId);
  if (!mission) return { ok: false, code: 'INVALID_MISSION', message: 'Unknown mission.' };

  const text = String(feedback || '').trim();
  if (text.length < FEEDBACK_MIN_CHARS) {
    return {
      ok: false,
      code: 'FEEDBACK_TOO_SHORT',
      message: `Feedback must be at least ${FEEDBACK_MIN_CHARS} characters.`,
      minChars: FEEDBACK_MIN_CHARS,
      currentChars: text.length,
    };
  }

  const progress = await getOrCreateProgress(user._id);
  const unlock = resolveUnlockState(progress);
  const records = recordMap(progress);
  const existing = records.get(missionId);

  if (existing?.completedAt) {
    return { ok: false, code: 'ALREADY_COMPLETE', message: 'Mission already completed.' };
  }
  if (unlock.activeMissionId !== missionId) {
    return { ok: false, code: 'NOT_UNLOCKED', message: 'This mission is not available yet.' };
  }
  if (unlock.locked) {
    return {
      ok: false,
      code: 'DAY_LOCKED',
      message: 'Next mission unlocks tomorrow.',
      nextUnlockMs: unlock.nextUnlockMs,
    };
  }
  if (!unlock.canCompleteToday) {
    return { ok: false, code: 'DAILY_LIMIT', message: 'Only one mission can be completed per day.' };
  }
  if (!existing?.taskAttestedAt) {
    return { ok: false, code: 'TASK_REQUIRED', message: 'Complete the assigned task before submitting feedback.' };
  }

  const today = utcDayKey();
  const savvyKey = `founding_tester_mission:${user._id}:${missionId}`;
  const savvyResult = await grantSavvyReward(user, {
    rewardType: 'founding_tester_mission',
    amount: mission.savvyReward,
    idempotencyKey: savvyKey,
    note: `Founding Tester — ${mission.title}`,
    meta: { missionId, feedbackLength: text.length },
  });

  await user.awardXP(mission.xpReward, `founding_tester_${missionId}`);

  const nextRecords = [...(progress.missionRecords || [])];
  const idx = nextRecords.findIndex((r) => r.missionId === missionId);
  const completion = {
    missionId,
    taskAttestedAt: existing.taskAttestedAt,
    taskVerified: existing.taskVerified,
    feedback: text.slice(0, 8000),
    feedbackLength: text.length,
    completedAt: new Date(),
    completionDayKey: today,
    savvyGranted: mission.savvyReward,
    xpGranted: mission.xpReward,
  };
  if (idx >= 0) nextRecords[idx] = { ...nextRecords[idx], ...completion };
  else nextRecords.push(completion);

  progress.missionRecords = nextRecords;

  const completedCount = nextRecords.filter((r) => r.completedAt).length;
  let grand = null;
  if (completedCount >= MISSION_COUNT && !progress.grandRewardGrantedAt) {
    grand = await grantGrandReward(user, progress);
  } else {
    await progress.save();
    await syncSlotProgress(user._id);
  }

  const snapshot = await getProgressSnapshot(user);

  return {
    ok: true,
    message: `Mission complete — +${mission.savvyReward} Savvy, +${mission.xpReward} XP`,
    savvyAwarded: savvyResult.amount || mission.savvyReward,
    xpAwarded: mission.xpReward,
    grandReward: grand?.granted ? grand : null,
    snapshot,
  };
}

module.exports = {
  getProgressSnapshot,
  attestTask,
  completeMission,
  resolveUnlockState,
};
