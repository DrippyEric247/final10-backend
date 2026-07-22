/**
 * Centralized Profile XP service — server-authoritative grants, recaps, and progress.
 */

const UserLevel = require('../models/UserLevel');
const {
  RECAP_CONFIG,
  LEVEL_MILESTONES,
  labelForSource,
  defaultAmountForSource,
} = require('../config/profileXpConfig');

const MAX_XP_HISTORY = 500;
const MAX_RECAPS = 120;
const MAX_ACTIVE_SESSIONS = 16;

function buildProgressSnapshot(userLevel) {
  const xpInfo = userLevel.getXPForCurrentLevel();
  return {
    level: userLevel.currentLevel,
    totalXp: userLevel.totalXP,
    lifetimeProfileXp: userLevel.totalXP,
    prestige: userLevel.prestige || 0,
    xpProgress: xpInfo.xpProgress,
    xpRange: xpInfo.xpRange,
    xpToNext: xpInfo.xpNeeded,
    xpPercent: xpInfo.xpRange > 0 ? Math.round((xpInfo.xpProgress / xpInfo.xpRange) * 100) : 0,
  };
}

function findSession(userLevel, sessionId) {
  return (userLevel.activeXpRecapSessions || []).find((s) => s.sessionId === sessionId);
}

function ensureSession(userLevel, { sessionId, title, trigger, eventId, eventSummaryId }) {
  if (!sessionId) return null;
  let session = findSession(userLevel, sessionId);
  if (!session) {
    session = {
      sessionId,
      title: title || 'Progression session',
      trigger: trigger || 'session_end',
      eventId: eventId || null,
      eventSummaryId: eventSummaryId || null,
      startedAt: new Date(),
      xpBreakdown: [],
      beforeSnapshot: buildProgressSnapshot(userLevel),
    };
    userLevel.activeXpRecapSessions.push(session);
  }
  return session;
}

function bumpBreakdown(session, source, amount) {
  if (!session) return;
  const label = labelForSource(source);
  const row = session.xpBreakdown.find((b) => b.source === source);
  if (row) {
    row.amount += amount;
  } else {
    session.xpBreakdown.push({ source, label, amount });
  }
}

function computeLevelUpsCrossed(beforeLevel, afterLevel, userLevel) {
  const crossed = [];
  for (let lvl = beforeLevel + 1; lvl <= afterLevel; lvl += 1) {
    const milestone = LEVEL_MILESTONES.find((m) => m.level === lvl);
    crossed.push({
      fromLevel: lvl - 1,
      toLevel: lvl,
      rewards: milestone ? { unlocks: milestone.unlocks, title: milestone.title } : null,
    });
  }
  return crossed;
}

function analyzeBreakdown(breakdown, total) {
  if (!breakdown?.length || total <= 0) {
    return {
      topSource: null,
      lowestSource: null,
      categoryPercentages: {},
      educationMessage: 'Keep exploring Final10 to earn more profile XP.',
      suggestedNextAction: 'Complete a Scout Contract or use Best Moves on your next hunt.',
      scoutMessage: 'Operator, your actions are building power.',
    };
  }

  const sorted = [...breakdown].sort((a, b) => b.amount - a.amount);
  const top = sorted[0];
  const lowest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const categoryPercentages = {};
  for (const row of breakdown) {
    categoryPercentages[row.source] = Math.round((row.amount / total) * 100);
  }

  const topPct = categoryPercentages[top.source] || 0;
  let educationMessage = `${top.label} generated the most profile XP this time.`;
  let suggestedNextAction = 'Complete one more high-value action to push your level bar.';

  if (top.source === 'contract_completed') {
    educationMessage = 'Contracts generated the most profile XP during this session.';
    suggestedNextAction = 'Complete one Gold Contract next to accelerate your level progress.';
  } else if (top.source === 'best_move_used') {
    educationMessage = 'Best Moves earned more XP than passive browsing.';
    suggestedNextAction = 'Use Best Moves on your next deal hunt for a quick XP boost.';
  } else if (top.source === 'event_participation') {
    educationMessage = `Event actions drove ${topPct}% of your profile XP.`;
    suggestedNextAction = 'Join the next live event to stack bonus Savvy and profile XP.';
  }

  const scoutMessage =
    topPct >= 30
      ? `${top.label} drove most of your progress this time.`
      : 'Operator, your actions are building power.';

  return {
    topSource: top,
    lowestSource: lowest && lowest.amount > 0 ? lowest : null,
    categoryPercentages,
    educationMessage,
    suggestedNextAction,
    scoutMessage,
  };
}

function serializeRecap(row) {
  return {
    recapId: row.recapId,
    sessionId: row.sessionId,
    title: row.title,
    trigger: row.trigger,
    eventId: row.eventId,
    eventSummaryId: row.eventSummaryId,
    xpEarnedTotal: row.xpEarnedTotal,
    breakdown: row.breakdown || [],
    topSource: row.topSource,
    lowestSource: row.lowestSource,
    categoryPercentages: row.categoryPercentages || {},
    educationMessage: row.educationMessage,
    suggestedNextAction: row.suggestedNextAction,
    scoutMessage: row.scoutMessage,
    beforeSnapshot: row.beforeSnapshot,
    afterSnapshot: row.afterSnapshot,
    levelUpsCrossed: row.levelUpsCrossed || [],
    milestoneUnlocks: row.milestoneUnlocks || [],
    recapShownAt: row.recapShownAt,
    dismissedAt: row.dismissedAt,
    createdAt: row.createdAt,
  };
}

async function getUserLevelDoc(userId) {
  return UserLevel.getUserLevelInfo(userId);
}

async function getProfileProgress(userId) {
  const userLevel = await getUserLevelDoc(userId);
  const snapshot = buildProgressSnapshot(userLevel);
  return {
    profileLevel: snapshot.level,
    profileXp: snapshot.totalXp,
    lifetimeProfileXp: snapshot.lifetimeProfileXp,
    prestige: snapshot.prestige,
    lastLevelUpAt: userLevel.lastLevelUpAt || null,
    xpProgress: snapshot.xpProgress,
    xpRange: snapshot.xpRange,
    xpToNext: snapshot.xpToNext,
    xpPercent: snapshot.xpPercent,
    milestones: userLevel.milestones || [],
    claimedMilestoneRewards: userLevel.claimedMilestoneRewards || [],
  };
}

/**
 * Grant profile XP with idempotency and optional session grouping.
 */
async function grantProfileXp(user, {
  amount,
  source,
  sourceId = null,
  metadata = {},
  idempotencyKey,
  sessionId = null,
  eventId = null,
  multiplier = 1,
  triggerRecap = false,
  sessionTitle = null,
  sessionTrigger = null,
  eventSummaryId = null,
}) {
  const userId = user._id || user.id;
  const userLevel = await getUserLevelDoc(userId);

  let xpAmount = Math.round(Number(amount) || 0);
  if (!xpAmount && source) {
    xpAmount = Math.round(defaultAmountForSource(source) * (Number(multiplier) || 1));
  }
  if (xpAmount <= 0) {
    return { granted: false, amount: 0, duplicate: false };
  }

  const key = String(idempotencyKey || '').trim();
  if (!key) {
    const err = new Error('grantProfileXp requires idempotencyKey');
    err.status = 400;
    err.code = 'IDEMPOTENCY_REQUIRED';
    throw err;
  }

  if ((userLevel.xpHistory || []).some((row) => row.idempotencyKey === key)) {
    return { granted: false, amount: 0, duplicate: true, progress: buildProgressSnapshot(userLevel) };
  }

  const effectiveSessionId =
    sessionId ||
    (eventId ? `event_${eventId}` : null) ||
    (triggerRecap ? `session_${source}_${Date.now()}` : null);

  const session = effectiveSessionId
    ? ensureSession(userLevel, {
        sessionId: effectiveSessionId,
        title: sessionTitle || labelForSource(source),
        trigger: sessionTrigger || (eventId ? 'event_end' : 'session_end'),
        eventId,
        eventSummaryId,
      })
    : null;

  const beforeLevel = userLevel.currentLevel;
  const awardResult = await userLevel.awardXP(xpAmount, source);

  userLevel.xpHistory.push({
    amount: xpAmount,
    source: source || 'task_completion',
    sourceId: sourceId ? String(sourceId) : null,
    eventId: eventId ? String(eventId) : null,
    sessionId: effectiveSessionId,
    metadata,
    idempotencyKey: key,
    createdAt: new Date(),
  });
  if (userLevel.xpHistory.length > MAX_XP_HISTORY) {
    userLevel.xpHistory = userLevel.xpHistory.slice(-MAX_XP_HISTORY);
  }

  if (awardResult.leveledUp) {
    userLevel.lastLevelUpAt = new Date();
  }

  if (session) {
    bumpBreakdown(session, source || 'task_completion', xpAmount);
  }

  userLevel.markModified('xpHistory');
  userLevel.markModified('activeXpRecapSessions');
  await userLevel.save();

  return {
    granted: true,
    amount: xpAmount,
    duplicate: false,
    leveledUp: awardResult.leveledUp,
    newLevel: awardResult.newLevel,
    levelsGained: awardResult.levelsGained,
    progress: buildProgressSnapshot(userLevel),
    sessionId: effectiveSessionId,
    beforeLevel,
  };
}

async function finalizeRecapSession(userId, {
  sessionId,
  title,
  trigger = 'session_end',
  eventId = null,
  eventSummaryId = null,
  force = false,
}) {
  const userLevel = await getUserLevelDoc(userId);
  const session = findSession(userLevel, sessionId);
  if (!session) return null;

  const total = (session.xpBreakdown || []).reduce((sum, row) => sum + row.amount, 0);
  if (!force && total < RECAP_CONFIG.minXpToShowRecap) {
    userLevel.activeXpRecapSessions = (userLevel.activeXpRecapSessions || []).filter(
      (s) => s.sessionId !== sessionId
    );
    userLevel.markModified('activeXpRecapSessions');
    await userLevel.save();
    return null;
  }

  const beforeSnapshot = session.beforeSnapshot || buildProgressSnapshot(userLevel);
  const afterSnapshot = buildProgressSnapshot(userLevel);
  const analysis = analyzeBreakdown(session.xpBreakdown, total);
  const levelUpsCrossed = computeLevelUpsCrossed(
    beforeSnapshot.level,
    afterSnapshot.level,
    userLevel
  );

  const milestoneUnlocks = levelUpsCrossed
    .filter((row) => row.rewards)
    .map((row) => ({ level: row.toLevel, ...row.rewards }));

  const recapId = sessionId;
  if ((userLevel.xpRecaps || []).some((r) => r.recapId === recapId)) {
    userLevel.activeXpRecapSessions = (userLevel.activeXpRecapSessions || []).filter(
      (s) => s.sessionId !== sessionId
    );
    userLevel.markModified('activeXpRecapSessions');
    await userLevel.save();
    return null;
  }

  const recap = {
    recapId,
    sessionId,
    title: title || session.title,
    trigger: trigger || session.trigger,
    eventId: eventId || session.eventId,
    eventSummaryId: eventSummaryId || session.eventSummaryId,
    xpEarnedTotal: total,
    breakdown: session.xpBreakdown,
    topSource: analysis.topSource,
    lowestSource: analysis.lowestSource,
    categoryPercentages: analysis.categoryPercentages,
    educationMessage: analysis.educationMessage,
    suggestedNextAction: analysis.suggestedNextAction,
    scoutMessage: analysis.scoutMessage,
    beforeSnapshot,
    afterSnapshot,
    levelUpsCrossed,
    milestoneUnlocks,
    recapShownAt: null,
    dismissedAt: null,
    createdAt: new Date(),
  };

  userLevel.xpRecaps.unshift(recap);
  if (userLevel.xpRecaps.length > MAX_RECAPS) {
    userLevel.xpRecaps = userLevel.xpRecaps.slice(0, MAX_RECAPS);
  }
  userLevel.activeXpRecapSessions = (userLevel.activeXpRecapSessions || []).filter(
    (s) => s.sessionId !== sessionId
  );
  userLevel.markModified('xpRecaps');
  userLevel.markModified('activeXpRecapSessions');
  await userLevel.save();

  return serializeRecap(recap);
}

async function buildXpRecap(userId, { sessionId, eventId, milestoneId }) {
  const userLevel = await getUserLevelDoc(userId);
  if (sessionId) {
    const row = (userLevel.xpRecaps || []).find((r) => r.sessionId === sessionId);
    if (row) return serializeRecap(row);
    const active = findSession(userLevel, sessionId);
    if (active) {
      return finalizeRecapSession(userId, { sessionId, force: true });
    }
  }
  if (eventId) {
    const row = (userLevel.xpRecaps || []).find((r) => r.eventId === eventId);
    if (row) return serializeRecap(row);
  }
  if (milestoneId) {
    const row = (userLevel.xpRecaps || []).find((r) => r.recapId === milestoneId);
    if (row) return serializeRecap(row);
  }
  return null;
}

async function getPendingRecap(userId) {
  const userLevel = await getUserLevelDoc(userId);
  const pending = (userLevel.xpRecaps || []).find((r) => !r.recapShownAt);
  return pending ? serializeRecap(pending) : null;
}

async function getRecapHistory(userId, { limit = 40 } = {}) {
  const userLevel = await getUserLevelDoc(userId);
  return (userLevel.xpRecaps || [])
    .filter((r) => r.recapShownAt)
    .slice(0, Math.min(limit, MAX_RECAPS))
    .map(serializeRecap);
}

async function markRecapShown(userId, recapId, { action = 'view' } = {}) {
  const userLevel = await getUserLevelDoc(userId);
  const row = (userLevel.xpRecaps || []).find((r) => r.recapId === recapId);
  if (!row) {
    const err = new Error('Profile XP recap not found.');
    err.status = 404;
    err.code = 'RECAP_NOT_FOUND';
    throw err;
  }
  const now = new Date();
  if (!row.recapShownAt) row.recapShownAt = now;
  if (action === 'dismiss') row.dismissedAt = now;
  userLevel.markModified('xpRecaps');
  await userLevel.save();
  return serializeRecap(row);
}

/** Link event summary finalize → profile XP recap session. */
async function finalizeEventProfileRecap(userId, { eventSummaryId, sessionId, title }) {
  return finalizeRecapSession(userId, {
    sessionId: sessionId || eventSummaryId,
    title: title || 'Event progression',
    trigger: 'event_end',
    eventSummaryId,
    force: false,
  });
}

module.exports = {
  grantProfileXp,
  getProfileProgress,
  buildXpRecap,
  getPendingRecap,
  getRecapHistory,
  markRecapShown,
  finalizeRecapSession,
  finalizeEventProfileRecap,
  buildProgressSnapshot,
};
