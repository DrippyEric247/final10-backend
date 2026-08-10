/**
 * Perk Machine Nuke Event — server-authoritative progression, activation, and reward multiplier.
 */

const crypto = require('crypto');
const {
  PERK_MACHINE_NUKE_SPIN_THRESHOLD,
  getNukeDurationMinutes,
  getNukeMultiplier,
  NUKE_MULTIPLIABLE_REWARD_TYPES,
  NUKE_MILESTONES,
  NUKE_QUALIFYING_RULES,
  NUKE_AUTO_TRIGGER_THRESHOLDS,
  NUKE_AUTO_TRIGGER_MODE,
  NUKE_V1_MAX_AUTO_TRIGGERS,
  getNextAutoTriggerThreshold,
} = require('../config/perkMachineNukeConfig');
const { MULTIPLIER_TYPE } = require('./perkMachineMultiplier');

const PROCESSED_SPIN_ID_CAP = 100;
const NUKE_HISTORY_CAP = 25;

function defaultNukeDoc() {
  return {
    lifetimeQualifyingSpins: 0,
    nukeEventsTriggered: 0,
    totalNukeBonusEarned: 0,
    highestNukeMultiplierAchieved: 0,
    lastActivationAt: null,
    lastCompletionAt: null,
    milestonesSeen: [],
    processedSpinIds: [],
    activeEvent: null,
    lastRunSummary: null,
    history: [],
  };
}

function ensureNukeDoc(pm) {
  if (!pm.nuke || typeof pm.nuke !== 'object') {
    pm.nuke = defaultNukeDoc();
  }
  if (!Array.isArray(pm.nuke.processedSpinIds)) pm.nuke.processedSpinIds = [];
  if (!Array.isArray(pm.nuke.milestonesSeen)) pm.nuke.milestonesSeen = [];
  if (!Array.isArray(pm.nuke.history)) pm.nuke.history = [];
  return pm.nuke;
}

function isNukeEventActive(nuke) {
  if (!nuke?.activeEvent?.expiresAt) return false;
  return new Date(nuke.activeEvent.expiresAt).getTime() > Date.now();
}

function getMilestoneForCount(count) {
  const n = Number(count) || 0;
  let hit = null;
  for (const m of NUKE_MILESTONES) {
    if (n >= m.at) hit = m;
  }
  return hit;
}

function getNewMilestone(nuke, count) {
  const milestone = getMilestoneForCount(count);
  if (!milestone) return null;
  const seen = nuke.milestonesSeen || [];
  if (seen.includes(milestone.id)) return null;
  return milestone;
}

function markMilestoneSeen(nuke, milestoneId) {
  if (!milestoneId) return;
  const seen = nuke.milestonesSeen || [];
  if (!seen.includes(milestoneId)) {
    nuke.milestonesSeen = [...seen, milestoneId];
  }
}

function formatNukeCountdown(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNukeUrgencyPhase(expiresAt) {
  if (!expiresAt) return 'idle';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  if (ms <= 60_000) return 'final60';
  if (ms <= 5 * 60_000) return 'final5min';
  if (ms <= getNukeDurationMinutes() * 60_000 * 0.5) return 'mid';
  return 'early';
}

function createNukeEvent(multiplier = getNukeMultiplier()) {
  const now = new Date();
  const durationMs = getNukeDurationMinutes() * 60 * 1000;
  const expiresAt = new Date(now.getTime() + durationMs);
  return {
    eventId: `nuke_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`,
    activatedAt: now,
    expiresAt,
    multiplier,
    spinsDuringEvent: 0,
    savvySpent: 0,
    baseSavvyEarned: 0,
    nukeBonusEarned: 0,
    highestCombinedMultiplier: multiplier,
    bestRewardLabel: null,
  };
}

function appendNukeHistory(nuke, summary) {
  if (!summary) return;
  const entry = {
    eventId: summary.eventId,
    completedAt: summary.completedAt,
    multiplier: summary.multiplier,
    spinsDuringEvent: summary.spinsDuringEvent,
    savvySpent: summary.savvySpent,
    baseSavvyEarned: summary.baseSavvyEarned,
    nukeBonusEarned: summary.nukeBonusEarned,
    totalSavvyEarned: summary.totalSavvyEarned,
    highestCombinedMultiplier: summary.highestCombinedMultiplier,
    bestRewardLabel: summary.bestRewardLabel || null,
  };
  nuke.history = [entry, ...(nuke.history || [])].slice(0, NUKE_HISTORY_CAP);
}

function formatNukeHistory(nuke) {
  const last = nuke.lastRunSummary;
  return {
    lifetimeQualifyingSpins: nuke.lifetimeQualifyingSpins || 0,
    nukeEventsTriggered: nuke.nukeEventsTriggered || 0,
    lastActivationAt: nuke.lastActivationAt || null,
    lastCompletionAt: nuke.lastCompletionAt || null,
    totalNukeBonusEarned: nuke.totalNukeBonusEarned || 0,
    highestNukeMultiplierAchieved: nuke.highestNukeMultiplierAchieved || 0,
    lastRun: last
      ? {
          spinsDuringEvent: last.spinsDuringEvent ?? 0,
          savvySpent: last.savvySpent ?? 0,
          baseSavvyEarned: last.baseSavvyEarned ?? 0,
          nukeBonusEarned: last.nukeBonusEarned ?? 0,
          totalSavvyEarned: last.totalSavvyEarned ?? 0,
          highestCombinedMultiplier: last.highestCombinedMultiplier ?? last.multiplier ?? 1,
          bestRewardLabel: last.bestRewardLabel || null,
          completedAt: last.completedAt || null,
        }
      : null,
    recentRuns: (nuke.history || []).slice(0, 5),
  };
}

function finalizeNukeEvent(nuke) {
  const ev = nuke.activeEvent;
  if (!ev) return null;
  return {
    eventId: ev.eventId,
    activatedAt: ev.activatedAt,
    completedAt: new Date(),
    multiplier: ev.multiplier,
    spinsDuringEvent: ev.spinsDuringEvent || 0,
    savvySpent: ev.savvySpent || 0,
    baseSavvyEarned: ev.baseSavvyEarned || 0,
    nukeBonusEarned: ev.nukeBonusEarned || 0,
    totalSavvyEarned: (ev.baseSavvyEarned || 0) + (ev.nukeBonusEarned || 0),
    highestCombinedMultiplier: ev.highestCombinedMultiplier || ev.multiplier,
    bestRewardLabel: ev.bestRewardLabel || null,
  };
}

/**
 * Expire Nuke if past expiration. Returns summary when event ends.
 */
function maybeExpireNukeEvent(user) {
  const pm = user.perkMachine;
  if (!pm) return null;
  const nuke = ensureNukeDoc(pm);
  if (!nuke.activeEvent?.expiresAt) return null;
  if (isNukeEventActive(nuke)) return null;

  const summary = finalizeNukeEvent(nuke);
  nuke.activeEvent = null;
  nuke.lastCompletionAt = summary?.completedAt || new Date();
  nuke.lastRunSummary = summary;
  appendNukeHistory(nuke, summary);
  user.markModified('perkMachine');
  return summary;
}

/**
 * Resolve Nuke eligibility at spin acceptance (authoritative moment).
 */
function captureNukeEligibility(user) {
  maybeExpireNukeEvent(user);
  const pm = user.perkMachine;
  const nuke = pm ? ensureNukeDoc(pm) : defaultNukeDoc();
  const active = isNukeEventActive(nuke);
  return {
    active,
    multiplier: active ? Number(nuke.activeEvent.multiplier) || getNukeMultiplier() : 1,
    expiresAt: active ? nuke.activeEvent.expiresAt : null,
    eventId: active ? nuke.activeEvent.eventId : null,
  };
}

function isQualifyingNukeSpin({ mode, savvyCostCharged, usedPaid3Token, usedPaid2Token, adminBypass }) {
  if (mode === 'free') return false;
  if (adminBypass && !NUKE_QUALIFYING_RULES.countAdminBypass) return false;
  if (NUKE_QUALIFYING_RULES.requirePaidSavvy) {
    if (Number(savvyCostCharged) <= 0) {
      if (!NUKE_QUALIFYING_RULES.countTokenSpins && (usedPaid3Token || usedPaid2Token)) {
        return false;
      }
      if (!NUKE_QUALIFYING_RULES.countFreeSpins) return false;
    }
  }
  return true;
}

function tryActivateNukeEvent(nuke, lifetimeCount) {
  if (isNukeEventActive(nuke)) return null;
  const threshold = getNextAutoTriggerThreshold(nuke, lifetimeCount);
  if (!threshold) return null;

  const event = createNukeEvent();
  nuke.activeEvent = event;
  nuke.nukeEventsTriggered = (nuke.nukeEventsTriggered || 0) + 1;
  nuke.lastActivationAt = event.activatedAt;
  return event;
}

/**
 * Record a qualifying spin after successful completion. Idempotent per spinId.
 */
function recordQualifyingNukeSpin(user, ctx) {
  const {
    spinId,
    mode,
    savvyCostCharged = 0,
    usedPaid3Token = false,
    usedPaid2Token = false,
    adminBypass = false,
  } = ctx;

  const pm = user.perkMachine;
  if (!pm) return null;
  const nuke = ensureNukeDoc(pm);

  if (!isQualifyingNukeSpin({ mode, savvyCostCharged, usedPaid3Token, usedPaid2Token, adminBypass })) {
    return { recorded: false, reason: 'not_qualifying' };
  }

  if (nuke.processedSpinIds.includes(spinId)) {
    return { recorded: false, reason: 'duplicate', nuke: formatNukeForClient(user) };
  }

  const before = nuke.lifetimeQualifyingSpins || 0;
  nuke.lifetimeQualifyingSpins = before + 1;
  nuke.processedSpinIds = [spinId, ...nuke.processedSpinIds].slice(0, PROCESSED_SPIN_ID_CAP);

  const milestone = getNewMilestone(nuke, nuke.lifetimeQualifyingSpins);
  if (milestone) markMilestoneSeen(nuke, milestone.id);

  let activation = null;
  activation = tryActivateNukeEvent(nuke, nuke.lifetimeQualifyingSpins);

  user.markModified('perkMachine');

  return {
    recorded: true,
    before,
    after: nuke.lifetimeQualifyingSpins,
    milestone,
    activation,
    thresholdReached: Boolean(activation),
    nuke: formatNukeForClient(user),
  };
}

function isNukeMultipliableType(type) {
  return NUKE_MULTIPLIABLE_REWARD_TYPES.has(String(type || ''));
}

/**
 * Apply Nuke multiplier after tile multiplier. Tile result first, then Nuke.
 */
function applyNukeMultiplierToReward(rewardDef, nukeFactor) {
  if (!rewardDef || nukeFactor <= 1 || rewardDef.type === MULTIPLIER_TYPE) {
    return { reward: rewardDef, nukeApplied: false, nukeBonusSavvy: 0 };
  }
  if (!isNukeMultipliableType(rewardDef.type)) {
    return { reward: rewardDef, nukeApplied: false, nukeBonusSavvy: 0 };
  }

  const out = { ...rewardDef, nukeMultiplier: nukeFactor };
  let nukeBonusSavvy = 0;

  if (rewardDef.type === 'savvy') {
    const currentAmount = Number(rewardDef.amount) || 0;
    const nukeAmount = Math.round(currentAmount * nukeFactor);
    nukeBonusSavvy = nukeAmount - currentAmount;
    out.baseAmount = rewardDef.baseAmount ?? currentAmount;
    out.amount = nukeAmount;
    out.label = `+${nukeAmount} Savvy`;
    if (nukeFactor > 1) {
      out.nukeBonusLabel = `+${nukeBonusSavvy} Nuke bonus`;
    }
  } else {
    const q = Math.max(1, Number(rewardDef.quantity) || 1);
    out.quantity = q * nukeFactor;
    if (nukeFactor > 1) {
      out.label = `${rewardDef.baseLabel || rewardDef.label} ×${out.quantity}`;
    }
  }

  return { reward: out, nukeApplied: true, nukeBonusSavvy };
}

function recordNukeSpinStats(user, {
  savvyCost = 0,
  baseSavvyEarned = 0,
  nukeBonusEarned = 0,
  combinedMultiplier = 1,
  bestRewardLabel = null,
}) {
  const nuke = ensureNukeDoc(user.perkMachine);
  if (!isNukeEventActive(nuke) || !nuke.activeEvent) return;

  const ev = nuke.activeEvent;
  ev.spinsDuringEvent = (ev.spinsDuringEvent || 0) + 1;
  ev.savvySpent = (ev.savvySpent || 0) + Math.max(0, Number(savvyCost) || 0);
  ev.baseSavvyEarned = (ev.baseSavvyEarned || 0) + Math.max(0, Number(baseSavvyEarned) || 0);
  ev.nukeBonusEarned = (ev.nukeBonusEarned || 0) + Math.max(0, Number(nukeBonusEarned) || 0);

  const combined = Number(combinedMultiplier) || 1;
  if (combined > (ev.highestCombinedMultiplier || 0)) {
    ev.highestCombinedMultiplier = combined;
  }
  if (bestRewardLabel && (!ev.bestRewardLabel || combined > 1)) {
    ev.bestRewardLabel = bestRewardLabel;
  }

  nuke.totalNukeBonusEarned = (nuke.totalNukeBonusEarned || 0) + Math.max(0, Number(nukeBonusEarned) || 0);
  if (combined > (nuke.highestNukeMultiplierAchieved || 0)) {
    nuke.highestNukeMultiplierAchieved = combined;
  }

  user.markModified('perkMachine');
}

function formatNukeForClient(user) {
  maybeExpireNukeEvent(user);
  const pm = user.perkMachine;
  const nuke = pm ? ensureNukeDoc(pm) : defaultNukeDoc();
  const lifetime = nuke.lifetimeQualifyingSpins || 0;
  const milestone = getMilestoneForCount(lifetime);
  const showProgress = Boolean(milestone?.showProgress) || lifetime >= PERK_MACHINE_NUKE_SPIN_THRESHOLD;
  const active = isNukeEventActive(nuke);

  const payload = {
    lifetimeQualifyingSpins: showProgress ? lifetime : null,
    threshold: showProgress ? PERK_MACHINE_NUKE_SPIN_THRESHOLD : null,
    hintsOnly: lifetime > 0 && !showProgress,
    milestone: milestone
      ? {
          id: milestone.id,
          message: milestone.message,
          intensity: milestone.intensity,
          at: milestone.at,
        }
      : null,
    nukeEventsTriggered: nuke.nukeEventsTriggered || 0,
    totalNukeBonusEarned: nuke.totalNukeBonusEarned || 0,
    highestNukeMultiplierAchieved: nuke.highestNukeMultiplierAchieved || 0,
    lastActivationAt: nuke.lastActivationAt || null,
    lastCompletionAt: nuke.lastCompletionAt || null,
    active: active
      ? {
          eventId: nuke.activeEvent.eventId,
          activatedAt: nuke.activeEvent.activatedAt,
          expiresAt: nuke.activeEvent.expiresAt,
          multiplier: nuke.activeEvent.multiplier,
          countdown: formatNukeCountdown(nuke.activeEvent.expiresAt),
          urgencyPhase: getNukeUrgencyPhase(nuke.activeEvent.expiresAt),
          spinsDuringEvent: nuke.activeEvent.spinsDuringEvent || 0,
        }
      : null,
    lastRunSummary: nuke.lastRunSummary || null,
    history: formatNukeHistory(nuke),
    config: {
      threshold: PERK_MACHINE_NUKE_SPIN_THRESHOLD,
      durationMinutes: getNukeDurationMinutes(),
      defaultMultiplier: getNukeMultiplier(),
      autoTriggerMode: NUKE_AUTO_TRIGGER_MODE,
      autoTriggerThresholds: NUKE_AUTO_TRIGGER_THRESHOLDS,
    },
  };

  return payload;
}

/** Admin: force-set qualifying spin count (testing). */
function adminSetNukeProgress(user, count) {
  const nuke = ensureNukeDoc(user.perkMachine);
  nuke.lifetimeQualifyingSpins = Math.max(0, Math.round(Number(count) || 0));
  user.markModified('perkMachine');
  return formatNukeForClient(user);
}

/** Admin: trigger Nuke immediately. */
function adminTriggerNuke(user, opts = {}) {
  const nuke = ensureNukeDoc(user.perkMachine);
  maybeExpireNukeEvent(user);
  if (isNukeEventActive(nuke)) {
    return { alreadyActive: true, nuke: formatNukeForClient(user) };
  }
  const multiplier = Number(opts.multiplier) || getNukeMultiplier();
  const durationMinutes = Number(opts.durationMinutes) || getNukeDurationMinutes();
  const now = new Date();
  const event = {
    eventId: `nuke_admin_${now.getTime()}_${crypto.randomBytes(4).toString('hex')}`,
    activatedAt: now,
    expiresAt: new Date(now.getTime() + durationMinutes * 60 * 1000),
    multiplier,
    spinsDuringEvent: 0,
    savvySpent: 0,
    baseSavvyEarned: 0,
    nukeBonusEarned: 0,
    highestCombinedMultiplier: multiplier,
    bestRewardLabel: null,
    adminTriggered: true,
  };
  nuke.activeEvent = event;
  nuke.nukeEventsTriggered = (nuke.nukeEventsTriggered || 0) + 1;
  nuke.lastActivationAt = event.activatedAt;
  user.markModified('perkMachine');
  return { triggered: true, nuke: formatNukeForClient(user) };
}

/** Admin: end active Nuke immediately. */
function adminEndNuke(user) {
  const nuke = ensureNukeDoc(user.perkMachine);
  if (!nuke.activeEvent) {
    return { ended: false, nuke: formatNukeForClient(user) };
  }
  nuke.activeEvent.expiresAt = new Date(Date.now() - 1000);
  const summary = maybeExpireNukeEvent(user);
  return { ended: true, summary, nuke: formatNukeForClient(user) };
}

module.exports = {
  PERK_MACHINE_NUKE_SPIN_THRESHOLD,
  defaultNukeDoc,
  ensureNukeDoc,
  isNukeEventActive,
  getMilestoneForCount,
  maybeExpireNukeEvent,
  captureNukeEligibility,
  isQualifyingNukeSpin,
  recordQualifyingNukeSpin,
  applyNukeMultiplierToReward,
  isNukeMultipliableType,
  recordNukeSpinStats,
  formatNukeForClient,
  formatNukeCountdown,
  getNukeUrgencyPhase,
  adminSetNukeProgress,
  adminTriggerNuke,
  adminEndNuke,
  createNukeEvent,
  finalizeNukeEvent,
};
