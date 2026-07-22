/**
 * Event Summary — track participation/earnings during timed events and surface
 * one-time post-event summaries + Profile history.
 */

const { getActivationDef, ACTIVATION_EVENT_KEYS } = require('../config/liveEventActivationConfig');
const { collectLiveActivationInstances } = require('./eventActivationService');

const MAX_ACTIVE_SESSIONS = 24;
const MAX_SUMMARIES = 120;

function ensureArrays(user) {
  if (!Array.isArray(user.activeEventSummarySessions)) {
    user.activeEventSummarySessions = [];
  }
  if (!Array.isArray(user.eventSummaries)) {
    user.eventSummaries = [];
  }
}

function defaultOptionalStats() {
  return {
    alertsCreated: 0,
    dealsWon: 0,
    bestMovesUsed: 0,
    auctionsWon: 0,
    scoutFlightEarnings: 0,
    contractsCompleted: 0,
    referralBonuses: 0,
    battlePassXpEarned: 0,
    eggsCollected: 0,
    perkSpins: 0,
    savvySaleSavings: 0,
  };
}

function sessionFromInstance(inst) {
  const def = getActivationDef(inst.eventKey);
  const mult = Number(inst.meta?.multiplier) || (inst.eventKey === ACTIVATION_EVENT_KEYS.TRIPLE_POINTS ? 3 : inst.eventKey === ACTIVATION_EVENT_KEYS.DOUBLE_POINTS ? 2 : 1);
  return {
    sessionId: inst.activationId,
    eventKey: inst.eventKey,
    eventTitle: def?.title || inst.eventKey,
    multiplier: mult,
    startedAt: new Date(),
    expiresAt: inst.expiresAt ? new Date(inst.expiresAt) : null,
    lastActivityAt: new Date(),
    participated: false,
    normalEarnings: 0,
    eventEarnings: 0,
    bonusEarned: 0,
    optionalStats: defaultOptionalStats(),
  };
}

function findSession(user, sessionId) {
  return (user.activeEventSummarySessions || []).find((s) => s.sessionId === sessionId);
}

function bumpOptionalStat(session, key, delta = 1) {
  if (!session.optionalStats) session.optionalStats = defaultOptionalStats();
  session.optionalStats[key] = Math.max(0, Number(session.optionalStats[key] || 0) + delta);
}

function computeIncreasePercent(normal, bonus) {
  const base = Math.max(0, Number(normal) || 0);
  const extra = Math.max(0, Number(bonus) || 0);
  if (base <= 0) return extra > 0 ? 100 : 0;
  return Math.round((extra / base) * 100);
}

function formatDurationMs(ms) {
  const totalMin = Math.max(0, Math.floor(Number(ms) / 60000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function msUntilNextWeekendStart(date = new Date()) {
  const day = date.getUTCDay();
  let daysUntilSat = (6 - day + 7) % 7;
  if (day === 6) daysUntilSat = 7;
  if (day === 0) daysUntilSat = 6;
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + daysUntilSat);
  next.setUTCHours(0, 0, 0, 0);
  return Math.max(0, next.getTime() - date.getTime());
}

function getUpcomingEventPreview() {
  const msUntilStart = msUntilNextWeekendStart();
  return {
    label: 'Next Weekend',
    title: 'Triple Points Weekend',
    icon: '🟣',
    msUntilStart,
  };
}

function serializeSummary(row, { includeUpcoming = false } = {}) {
  const normal = Math.round(Number(row.normalEarnings) || 0);
  const event = Math.round(Number(row.eventEarnings) || 0);
  const bonus = Math.round(Number(row.bonusEarned) || Math.max(0, event - normal));
  const started = row.startedAt ? new Date(row.startedAt) : null;
  const ended = row.endedAt ? new Date(row.endedAt) : null;
  const timeParticipatedMs =
    Number(row.timeParticipatedMs) ||
    (started && ended ? Math.max(0, ended.getTime() - started.getTime()) : 0);

  return {
    summaryId: row.summaryId,
    eventKey: row.eventKey,
    eventTitle: row.eventTitle,
    startedAt: started?.toISOString() || null,
    endedAt: ended?.toISOString() || null,
    timeParticipatedMs,
    timeParticipatedLabel: formatDurationMs(timeParticipatedMs),
    normalEarnings: normal,
    eventEarnings: event,
    bonusEarned: bonus,
    increasePercent: computeIncreasePercent(normal, bonus),
    optionalStats: row.optionalStats || defaultOptionalStats(),
    summaryShownAt: row.summaryShownAt || null,
    dismissedAt: row.dismissedAt || null,
    upcomingEvent: includeUpcoming ? row.upcomingEvent || getUpcomingEventPreview() : row.upcomingEvent || null,
  };
}

async function syncActiveSessions(user) {
  ensureArrays(user);
  const live = await collectLiveActivationInstances(user);
  const liveIds = new Set(live.map((i) => i.activationId));

  for (const inst of live) {
    if (findSession(user, inst.activationId)) continue;
    user.activeEventSummarySessions.push(sessionFromInstance(inst));
  }

  if (user.activeEventSummarySessions.length > MAX_ACTIVE_SESSIONS) {
    user.activeEventSummarySessions = user.activeEventSummarySessions.slice(-MAX_ACTIVE_SESSIONS);
  }
  user.markModified('activeEventSummarySessions');
}

async function grantEventProfileXp(user, session) {
  try {
    const { grantProfileXp, finalizeEventProfileRecap } = require('./profileXpService');
    const { XP_SOURCES, XP_AMOUNTS } = require('../config/profileXpConfig');
    const stats = session.optionalStats || {};
    const sessionId = session.sessionId;

    const savvyXp = Math.round((session.bonusEarned || 0) * 0.18);
    if (savvyXp > 0) {
      await grantProfileXp(user, {
        amount: savvyXp,
        source: XP_SOURCES.EVENT_PARTICIPATION,
        idempotencyKey: `event_xp_savvy:${sessionId}`,
        sessionId,
        eventId: session.eventKey,
        sessionTitle: `${session.eventTitle} — Profile XP`,
        sessionTrigger: 'event_end',
        metadata: { kind: 'savvy_bonus' },
      });
    }

    const statGrants = [
      ['bestMovesUsed', XP_SOURCES.BEST_MOVE_USED, XP_AMOUNTS[XP_SOURCES.BEST_MOVE_USED]],
      ['alertsCreated', XP_SOURCES.ALERT_CREATED, XP_AMOUNTS[XP_SOURCES.ALERT_CREATED]],
      ['contractsCompleted', XP_SOURCES.CONTRACT_COMPLETED, XP_AMOUNTS[XP_SOURCES.CONTRACT_COMPLETED]],
      ['scoutFlightEarnings', XP_SOURCES.SCOUT_FLIGHT_RUN, XP_AMOUNTS[XP_SOURCES.SCOUT_FLIGHT_RUN]],
    ];

    for (const [statKey, source, perUnit] of statGrants) {
      const count = Number(stats[statKey]) || 0;
      if (count <= 0) continue;
      await grantProfileXp(user, {
        amount: perUnit * count,
        source,
        idempotencyKey: `event_xp_${statKey}:${sessionId}`,
        sessionId,
        eventId: session.eventKey,
        sessionTitle: `${session.eventTitle} — Profile XP`,
        sessionTrigger: 'event_end',
        metadata: { statKey, count },
      });
    }

    if (session.participated && savvyXp <= 0 && !statGrants.some(([k]) => Number(stats[k]) > 0)) {
      await grantProfileXp(user, {
        amount: 50,
        source: XP_SOURCES.EVENT_PARTICIPATION,
        idempotencyKey: `event_xp_participation:${sessionId}`,
        sessionId,
        eventId: session.eventKey,
        sessionTitle: `${session.eventTitle} — Profile XP`,
        sessionTrigger: 'event_end',
      });
    }

    await finalizeEventProfileRecap(user._id, {
      sessionId,
      eventSummaryId: sessionId,
      title: `${session.eventTitle} — Profile Progression`,
    });
  } catch (err) {
    console.warn('[eventSummary] profile XP recap failed:', err?.message);
  }
}

async function appendSummaryFromSession(user, session) {
  const endedAt = session.expiresAt ? new Date(session.expiresAt) : new Date();
  const startedAt = session.startedAt ? new Date(session.startedAt) : endedAt;
  const timeParticipatedMs = Math.max(
    0,
    Math.min(
      endedAt.getTime() - startedAt.getTime(),
      (session.lastActivityAt ? new Date(session.lastActivityAt).getTime() : endedAt.getTime()) -
        startedAt.getTime()
    )
  );

  const normal = Math.round(Number(session.normalEarnings) || 0);
  const event = Math.round(Number(session.eventEarnings) || 0);
  const bonus = Math.round(Number(session.bonusEarned) || Math.max(0, event - normal));

  if (bonus <= 0 && event <= 0 && !session.participated) {
    return null;
  }

  if ((user.eventSummaries || []).some((s) => s.summaryId === session.sessionId)) {
    return null;
  }

  const row = {
    summaryId: session.sessionId,
    eventKey: session.eventKey,
    eventTitle: session.eventTitle,
    startedAt,
    endedAt,
    timeParticipatedMs,
    normalEarnings: normal,
    eventEarnings: event,
    bonusEarned: bonus,
    increasePercent: computeIncreasePercent(normal, bonus),
    optionalStats: session.optionalStats || defaultOptionalStats(),
    summaryShownAt: null,
    dismissedAt: null,
    upcomingEvent: getUpcomingEventPreview(),
    createdAt: new Date(),
  };

  user.eventSummaries.unshift(row);
  if (user.eventSummaries.length > MAX_SUMMARIES) {
    user.eventSummaries = user.eventSummaries.slice(0, MAX_SUMMARIES);
  }
  user.markModified('eventSummaries');
  await grantEventProfileXp(user, session);
  return row;
}

async function finalizeExpiredSessions(user) {
  ensureArrays(user);
  const live = await collectLiveActivationInstances(user);
  const liveIds = new Set(live.map((i) => i.activationId));
  const now = Date.now();
  const keep = [];

  for (const session of user.activeEventSummarySessions || []) {
    const expiredByTime = session.expiresAt && new Date(session.expiresAt).getTime() <= now;
    const stillLive = liveIds.has(session.sessionId);
    if (stillLive && !expiredByTime) {
      keep.push(session);
      continue;
    }
    await appendSummaryFromSession(user, session);
  }

  user.activeEventSummarySessions = keep;
  user.markModified('activeEventSummarySessions');
}

async function syncAndFinalize(user) {
  await syncActiveSessions(user);
  await finalizeExpiredSessions(user);
}

async function ensureSessionFromActivation(user, { activationId, eventKey }) {
  await syncActiveSessions(user);
  const live = await collectLiveActivationInstances(user);
  const inst = live.find((i) => i.activationId === activationId && i.eventKey === eventKey);
  if (!inst) return null;

  let session = findSession(user, activationId);
  if (!session) {
    session = sessionFromInstance(inst);
    user.activeEventSummarySessions.push(session);
  }
  session.participated = true;
  session.lastActivityAt = new Date();
  user.markModified('activeEventSummarySessions');
  return session;
}

function pickPointsSession(user, grantMultiplier) {
  const sessions = user.activeEventSummarySessions || [];
  const mult = Number(grantMultiplier) || 1;
  if (mult >= 3) {
    return sessions.find((s) => s.eventKey === ACTIVATION_EVENT_KEYS.TRIPLE_POINTS) || null;
  }
  if (mult >= 2) {
    return (
      sessions.find((s) => s.eventKey === ACTIVATION_EVENT_KEYS.TRIPLE_POINTS) ||
      sessions.find((s) => s.eventKey === ACTIVATION_EVENT_KEYS.DOUBLE_POINTS) ||
      null
    );
  }
  return null;
}

async function recordSavvyEarnedForActiveEvents(user, { amount, multiplier = 1, meta = {} }) {
  const savvyAmount = Math.round(Number(amount) || 0);
  if (!savvyAmount || savvyAmount <= 0) return;

  await syncActiveSessions(user);

  let session = null;
  if (meta.eventSessionId) {
    session = findSession(user, meta.eventSessionId);
  }
  if (!session) {
    session = pickPointsSession(user, multiplier);
  }
  if (!session && (user.activeEventSummarySessions || []).length === 1) {
    [session] = user.activeEventSummarySessions;
  }
  if (!session) return;

  const eventMult = Math.max(1, Number(session.multiplier) || Number(multiplier) || 1);
  const normalPart = eventMult > 1 ? Math.round(savvyAmount / eventMult) : savvyAmount;

  session.participated = true;
  session.eventEarnings += savvyAmount;
  session.normalEarnings += normalPart;
  session.bonusEarned = session.eventEarnings - session.normalEarnings;
  session.lastActivityAt = new Date();

  const statKey = meta.eventStatKey;
  if (statKey && typeof statKey === 'string') {
    bumpOptionalStat(session, statKey, Number(meta.eventStatDelta) || 1);
  }

  user.markModified('activeEventSummarySessions');
}

async function recordSavvySaleSavings(user, savings) {
  const amount = Math.round(Number(savings) || 0);
  if (amount <= 0) return;
  await syncActiveSessions(user);
  const session = (user.activeEventSummarySessions || []).find(
    (s) => s.eventKey === ACTIVATION_EVENT_KEYS.SAVVY_SALE
  );
  if (!session) return;
  session.participated = true;
  session.bonusEarned += amount;
  session.eventEarnings += amount;
  bumpOptionalStat(session, 'savvySaleSavings', amount);
  bumpOptionalStat(session, 'perkSpins', 1);
  session.lastActivityAt = new Date();
  user.markModified('activeEventSummarySessions');
}

async function recordSupplyDropReward(user, { dropId, savvyAmount = 0, label }) {
  await syncActiveSessions(user);
  const sessionId = `max_supply_drop_${dropId}`;
  let session = findSession(user, sessionId);
  if (!session) {
    const def = getActivationDef(ACTIVATION_EVENT_KEYS.MAX_SUPPLY_DROP);
    session = {
      sessionId,
      eventKey: ACTIVATION_EVENT_KEYS.MAX_SUPPLY_DROP,
      eventTitle: def?.title || 'Max Supply Drop',
      multiplier: 1,
      startedAt: new Date(),
      expiresAt: null,
      lastActivityAt: new Date(),
      participated: true,
      normalEarnings: 0,
      eventEarnings: 0,
      bonusEarned: 0,
      optionalStats: defaultOptionalStats(),
    };
    user.activeEventSummarySessions.push(session);
  }
  const amt = Math.round(Number(savvyAmount) || 0);
  if (amt > 0) {
    session.eventEarnings += amt;
    session.bonusEarned += amt;
  } else if (label) {
    session.participated = true;
  }
  session.lastActivityAt = new Date();
  user.markModified('activeEventSummarySessions');
}

async function getPendingSummary(user) {
  await syncAndFinalize(user);
  const pending = (user.eventSummaries || []).find((s) => !s.summaryShownAt);
  if (!pending) return null;
  return serializeSummary(pending, { includeUpcoming: true });
}

async function getEventHistory(user, { limit = 40 } = {}) {
  await syncAndFinalize(user);
  const rows = (user.eventSummaries || [])
    .filter((row) => row.summaryShownAt)
    .slice(0, Math.min(limit, MAX_SUMMARIES));
  return rows.map((row) => serializeSummary(row));
}

async function markSummaryShown(user, summaryId, { action = 'view' } = {}) {
  await syncAndFinalize(user);
  const id = String(summaryId || '').trim();
  const row = (user.eventSummaries || []).find((s) => s.summaryId === id);
  if (!row) {
    const err = new Error('Event summary not found.');
    err.status = 404;
    err.code = 'SUMMARY_NOT_FOUND';
    throw err;
  }

  const now = new Date();
  if (!row.summaryShownAt) {
    row.summaryShownAt = now;
  }
  if (action === 'dismiss') {
    row.dismissedAt = now;
  }
  if (action === 'leaderboard') {
    row.leaderboardClicked = true;
  }
  if (action === 'rewards') {
    row.rewardsClicked = true;
  }
  user.markModified('eventSummaries');
  await user.save();
  return serializeSummary(row, { includeUpcoming: true });
}

module.exports = {
  syncAndFinalize,
  ensureSessionFromActivation,
  recordSavvyEarnedForActiveEvents,
  recordSavvySaleSavings,
  recordSupplyDropReward,
  getPendingSummary,
  getEventHistory,
  markSummaryShown,
  getUpcomingEventPreview,
  formatDurationMs,
};
