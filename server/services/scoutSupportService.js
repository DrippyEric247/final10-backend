/**
 * Scout Support (Deal Streak) — progress, milestones, call-in rewards.
 */

const {
  SCOUT_SUPPORT_MILESTONES,
  DEAL_ACTION_TYPES,
  findMilestoneConfig,
  nextMilestoneAfter,
} = require('../config/scoutSupportConfig');
const { applyEventReward } = require('./eventRewardService');
const { createSupplyDrop } = require('./supplyDropService');
const { startSavvySale } = require('./savvySaleService');
const { DEFAULT_SCOUT_SUPPORT_SALE_MINUTES } = require('../config/savvySaleConfig');

class ScoutSupportError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function ensureScoutSupportDoc(user) {
  if (!user.scoutSupport || typeof user.scoutSupport !== 'object') {
    user.scoutSupport = {};
  }
  const ss = user.scoutSupport;
  if (typeof ss.dealStreakCount !== 'number') ss.dealStreakCount = 0;
  if (typeof ss.scoutSupportProgress !== 'number') ss.scoutSupportProgress = 0;
  if (!Array.isArray(ss.scoutSupportMilestonesClaimed)) ss.scoutSupportMilestonesClaimed = [];
  if (!Array.isArray(ss.milestonesReady)) ss.milestonesReady = [];
  if (!Array.isArray(ss.dealStreakHistory)) ss.dealStreakHistory = [];
  return ss;
}

function milestoneClaimed(ss, milestone) {
  return (ss.scoutSupportMilestonesClaimed || []).includes(Number(milestone));
}

function milestoneReady(ss, milestone) {
  return (ss.milestonesReady || []).some((m) => Number(m.milestone) === Number(milestone));
}

function pushHistory(ss, action, meta = {}) {
  ss.dealStreakHistory.unshift({
    action,
    meta,
    createdAt: new Date(),
  });
  if (ss.dealStreakHistory.length > 100) {
    ss.dealStreakHistory = ss.dealStreakHistory.slice(0, 100);
  }
}

function buildStatus(user) {
  const ss = ensureScoutSupportDoc(user);
  const count = Number(ss.dealStreakCount) || 0;
  const next = nextMilestoneAfter(count);
  const prevMilestone = [...SCOUT_SUPPORT_MILESTONES].reverse().find((m) => m.milestone <= count);
  const progressBase = prevMilestone ? prevMilestone.milestone : 0;
  const progressTarget = next ? next.milestone : SCOUT_SUPPORT_MILESTONES[SCOUT_SUPPORT_MILESTONES.length - 1].milestone;
  const progressCurrent = count - progressBase;
  const progressTotal = progressTarget - progressBase;

  return {
    dealStreakCount: count,
    scoutSupportProgress: count,
    progressCurrent: Math.min(progressCurrent, progressTotal),
    progressTotal,
    nextMilestone: next
      ? {
          milestone: next.milestone,
          label: next.label,
          icon: next.icon,
          description: next.description,
        }
      : null,
    milestonesReady: (ss.milestonesReady || []).map((m) => ({
      milestone: m.milestone,
      label: m.label,
      icon: m.icon,
      unlockedAt: m.unlockedAt,
    })),
    milestonesClaimed: [...(ss.scoutSupportMilestonesClaimed || [])],
    recentHistory: (ss.dealStreakHistory || []).slice(0, 10),
    eventInventory: user.eventInventory || {},
  };
}

async function registerDealAction(user, actionType, meta = {}) {
  const action = String(actionType || '').trim();
  if (!DEAL_ACTION_TYPES.includes(action)) {
    throw new ScoutSupportError(400, 'INVALID_ACTION', 'Unknown deal action type.');
  }

  const ss = ensureScoutSupportDoc(user);
  ss.dealStreakCount = Number(ss.dealStreakCount || 0) + 1;
  ss.scoutSupportProgress = ss.dealStreakCount;
  pushHistory(ss, action, meta);

  const count = ss.dealStreakCount;
  const milestoneCfg = findMilestoneConfig(count);
  let newlyUnlocked = null;

  if (milestoneCfg && !milestoneClaimed(ss, count) && !milestoneReady(ss, count)) {
    ss.milestonesReady.push({
      milestone: count,
      label: milestoneCfg.label,
      icon: milestoneCfg.icon,
      rewardType: milestoneCfg.rewardType,
      unlockedAt: new Date(),
    });
    newlyUnlocked = {
      milestone: count,
      label: milestoneCfg.label,
      icon: milestoneCfg.icon,
      description: milestoneCfg.description,
    };
  }

  user.markModified('scoutSupport');
  await user.save();

  return {
    status: buildStatus(user),
    newlyUnlocked,
  };
}

async function claimMilestone(user, milestone) {
  const m = Number(milestone);
  const cfg = findMilestoneConfig(m);
  if (!cfg) {
    throw new ScoutSupportError(400, 'INVALID_MILESTONE', 'Unknown milestone.');
  }

  const ss = ensureScoutSupportDoc(user);
  if (milestoneClaimed(ss, m)) {
    throw new ScoutSupportError(409, 'ALREADY_CLAIMED', 'Milestone reward already claimed.');
  }
  if (!milestoneReady(ss, m) && ss.dealStreakCount < m) {
    throw new ScoutSupportError(403, 'MILESTONE_LOCKED', 'Milestone not unlocked yet.');
  }

  let resultPayload = { milestone: m, label: cfg.label, rewardType: cfg.rewardType };

  if (cfg.rewardType === 'supply_drop') {
    const drop = await createSupplyDrop({
      scope: 'user',
      userId: user._id,
      createdBy: user._id,
      source: 'scoutSupport',
    });
    resultPayload.supplyDrop = drop;
  } else if (cfg.rewardType === 'savvy_sale') {
    const sale = await startSavvySale({
      durationMinutes: cfg.savvySaleMinutes || DEFAULT_SCOUT_SUPPORT_SALE_MINUTES,
      createdBy: user._id,
      source: 'scoutSupport',
      meta: { milestone: m, userId: String(user._id) },
    });
    resultPayload.savvySale = sale;
  } else if (cfg.rewardType === 'placeholder') {
    const granted = await applyEventReward(
      user,
      {
        id: `scout_milestone_${m}`,
        type: 'placeholder',
        placeholderKey: cfg.placeholderKey,
        label: cfg.label,
        icon: cfg.icon,
        rarity: 'legendary',
      },
      `scout_support:${user._id}:${m}`
    );
    resultPayload.placeholder = granted;
    await user.save();
  }

  ss.scoutSupportMilestonesClaimed.push(m);
  ss.milestonesReady = (ss.milestonesReady || []).filter((x) => Number(x.milestone) !== m);
  user.markModified('scoutSupport');
  await user.save();

  return {
    ...resultPayload,
    status: buildStatus(user),
  };
}

async function adminSetStreak(user, count) {
  const ss = ensureScoutSupportDoc(user);
  const n = Math.max(0, Math.min(999, Math.round(Number(count) || 0)));
  ss.dealStreakCount = n;
  ss.scoutSupportProgress = n;
  ss.milestonesReady = [];
  for (const cfg of SCOUT_SUPPORT_MILESTONES) {
    if (n >= cfg.milestone && !milestoneClaimed(ss, cfg.milestone)) {
      ss.milestonesReady.push({
        milestone: cfg.milestone,
        label: cfg.label,
        icon: cfg.icon,
        rewardType: cfg.rewardType,
        unlockedAt: new Date(),
      });
    }
  }
  user.markModified('scoutSupport');
  await user.save();
  return buildStatus(user);
}

async function adminResetScoutSupport(user) {
  user.scoutSupport = {
    dealStreakCount: 0,
    scoutSupportProgress: 0,
    scoutSupportMilestonesClaimed: [],
    milestonesReady: [],
    dealStreakHistory: [],
  };
  user.markModified('scoutSupport');
  await user.save();
  return buildStatus(user);
}

module.exports = {
  ScoutSupportError,
  buildStatus,
  registerDealAction,
  claimMilestone,
  adminSetStreak,
  adminResetScoutSupport,
  ensureScoutSupportDoc,
  DEAL_ACTION_TYPES,
};
