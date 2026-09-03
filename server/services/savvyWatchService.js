/**
 * Savvy Watch — core event orchestration.
 */
const crypto = require('crypto');
const SavvyWatchEvent = require('../models/SavvyWatchEvent');
const SavvyWatchSession = require('../models/SavvyWatchSession');
const SavvyWatchCompetition = require('../models/SavvyWatchCompetition');
const SavvyWatchAudit = require('../models/SavvyWatchAudit');
const {
  isSavvyWatchEnabled,
  isSavvyWatchAdminOnly,
  generateEventId,
  normalizeAttributionSource,
  DEFAULT_CHECKPOINTS,
  DEFAULT_MAX_SAVVY_PER_VIEWER,
} = require('../config/savvyWatchConfig');
const { isSavvyPredictionsEnabled } = require('../config/savvyPredictionsConfig');
const { GTA_CAR_MEET_PRESET } = require('../config/savvyWatchGtaPreset');
const {
  findOrCreateSession,
  processHeartbeat,
  buildCheckpointProgress,
} = require('./savvyWatchPresenceService');
const { claimSavvyWatchReward, SavvyWatchRewardError } = require('./savvyWatchRewardService');

class SavvyWatchError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'SavvyWatchError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function assertSavvyWatchAccess(user, { adminOk = false } = {}) {
  if (!isSavvyWatchEnabled()) {
    throw new SavvyWatchError(503, 'SAVVY_WATCH_DISABLED', 'Savvy Watch is not enabled.');
  }
  if (isSavvyWatchAdminOnly() && !adminOk) {
    const role = String(user?.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin' || user?.foundingAccess;
    if (!isAdmin) {
      throw new SavvyWatchError(403, 'SAVVY_WATCH_ADMIN_ONLY', 'Savvy Watch is in admin preview mode.');
    }
  }
}

async function logAudit(eventId, actorUserId, action, meta = {}) {
  await SavvyWatchAudit.create({
    auditId: `swa_${crypto.randomBytes(8).toString('hex')}`,
    eventId,
    actorUserId: actorUserId || null,
    action,
    targetType: meta.targetType || null,
    targetId: meta.targetId || null,
    meta,
  }).catch(() => {});
}

function serializeEventPublic(event, { participantCount = 0 } = {}) {
  if (!event) return null;
  return {
    eventId: event.eventId,
    slug: event.slug,
    title: event.title,
    description: event.description,
    status: event.status,
    platform: event.platform,
    platformUrl: event.platformUrl,
    youtubeVideoId: event.youtubeVideoId,
    youtubeChannelId: event.youtubeChannelId,
    scheduledStartAt: event.scheduledStartAt,
    actualStartAt: event.actualStartAt,
    endedAt: event.endedAt,
    hostDisplayName: event.hostDisplayName,
    streamCategory: event.streamCategory,
    rewardRules: {
      maxSavvyPerViewer: event.rewardRules?.maxSavvyPerViewer ?? DEFAULT_MAX_SAVVY_PER_VIEWER,
      label: event.rewardRules?.label || 'Verified Event Participation',
      checkpointCount: Array.isArray(event.rewardRules?.checkpoints) ? event.rewardRules.checkpoints.length : 0,
    },
    savvyWatchParticipants: participantCount,
    participationMetricLabel: 'Savvy Watch Participants',
  };
}

async function getParticipantCount(eventId) {
  return SavvyWatchSession.countDocuments({ eventId, status: { $in: ['active', 'inactive', 'completed'] } });
}

async function getEventBySlug(slug) {
  return SavvyWatchEvent.findOne({ slug: String(slug).trim().toLowerCase() });
}

async function getPublicEventPage(slug) {
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');
  const participantCount = await getParticipantCount(event.eventId);
  const competitions = await SavvyWatchCompetition.find({ eventId: event.eventId })
    .select('competitionId slug title description type status votingMode rewardConfig')
    .lean();

  let predictions = [];
  if (isSavvyPredictionsEnabled()) {
    try {
      const { listEventPredictions } = require('./savvyPredictionsService');
      predictions = await listEventPredictions(event.eventId);
    } catch {
      predictions = [];
    }
  }

  return {
    event: serializeEventPublic(event, { participantCount }),
    competitions,
    predictions,
    featureFlags: {
      enabled: isSavvyWatchEnabled(),
      adminOnly: isSavvyWatchAdminOnly(),
      predictionsEnabled: isSavvyPredictionsEnabled(),
    },
  };
}

async function joinEvent(user, slug, { source = 'unknown' } = {}) {
  assertSavvyWatchAccess(user);
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');
  if (!['scheduled', 'live'].includes(event.status)) {
    throw new SavvyWatchError(400, 'EVENT_NOT_JOINABLE', 'This event is not open for participation.');
  }

  const joinSource = normalizeAttributionSource(source);
  await SavvyWatchEvent.updateOne(
    { eventId: event.eventId },
    { $inc: { [`attributionCounts.${joinSource}`]: 1 } }
  );

  const session = await findOrCreateSession({
    eventId: event.eventId,
    userId: user._id,
    joinSource,
  });

  const joinCheckpoint = (event.rewardRules?.checkpoints || DEFAULT_CHECKPOINTS).find((c) => c.kind === 'join');
  let joinReward = null;
  if (joinCheckpoint && !session.checkpointClaims.includes(joinCheckpoint.id)) {
    try {
      joinReward = await claimSavvyWatchReward(user, {
        eventId: event.eventId,
        sessionId: session.sessionId,
        claimType: 'join',
        checkpointId: joinCheckpoint.id,
        amount: joinCheckpoint.savvyReward,
        rewardType: 'savvy_watch_join',
        note: `Savvy Watch join — ${event.title}`,
        meta: { checkpointId: joinCheckpoint.id, joinSource },
      });
      session.checkpointClaims.push(joinCheckpoint.id);
      await session.save();
    } catch (err) {
      if (!(err instanceof SavvyWatchRewardError && err.code === 'VIEWER_CAP_EXCEEDED')) throw err;
    }
  }

  return {
    sessionId: session.sessionId,
    joinedAt: session.joinedAt,
    joinReward,
    checkpoints: buildCheckpointProgress(event, session),
    savvyEarned: session.savvyEarned,
    verifiedActiveSeconds: session.verifiedActiveSeconds,
    participationLabel: 'Verified Event Participation',
  };
}

async function sendHeartbeat(user, slug, payload = {}) {
  assertSavvyWatchAccess(user);
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');
  if (event.status !== 'live') {
    throw new SavvyWatchError(400, 'EVENT_NOT_LIVE', 'Heartbeats are only accepted while the event is live.');
  }

  const session = await SavvyWatchSession.findOne({ eventId: event.eventId, userId: user._id });
  if (!session) throw new SavvyWatchError(400, 'NOT_JOINED', 'Join the event before sending heartbeats.');

  const hb = await processHeartbeat(session, payload);
  const refreshed = await SavvyWatchSession.findById(session._id);
  return {
    ...hb,
    savvyEarned: refreshed.savvyEarned,
    checkpoints: buildCheckpointProgress(event, refreshed),
  };
}

async function claimCheckpoint(user, slug, checkpointId) {
  assertSavvyWatchAccess(user);
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');

  const session = await SavvyWatchSession.findOne({ eventId: event.eventId, userId: user._id });
  if (!session) throw new SavvyWatchError(400, 'NOT_JOINED', 'Join the event before claiming rewards.');

  const checkpoint = (event.rewardRules?.checkpoints || DEFAULT_CHECKPOINTS).find((c) => c.id === checkpointId);
  if (!checkpoint) throw new SavvyWatchError(404, 'CHECKPOINT_NOT_FOUND', 'Reward checkpoint not found.');

  if (session.checkpointClaims.includes(checkpointId)) {
    throw new SavvyWatchError(409, 'ALREADY_CLAIMED', 'This checkpoint was already claimed.');
  }

  const verifiedSeconds = Math.round(Number(session.verifiedActiveSeconds) || 0);
  const required = Math.round(Number(checkpoint.requiredSeconds) || 0);

  if (checkpoint.kind === 'presence' && verifiedSeconds < required) {
    throw new SavvyWatchRewardError(400, 'CHECKPOINT_NOT_ELIGIBLE', 'Checkpoint not awarded because verified event participation was insufficient during the required interval.', {
      requiredSeconds: required,
      verifiedActiveSeconds: verifiedSeconds,
      participationLabel: 'Verified Event Participation',
    });
  }

  if (checkpoint.kind === 'completion' && event.status !== 'ended') {
    throw new SavvyWatchRewardError(400, 'CHECKPOINT_NOT_ELIGIBLE', 'Completion reward is available after the event ends.');
  }

  const result = await claimSavvyWatchReward(user, {
    eventId: event.eventId,
    sessionId: session.sessionId,
    claimType: checkpoint.kind === 'join' ? 'join' : checkpoint.kind === 'completion' ? 'completion' : 'checkpoint',
    checkpointId,
    amount: checkpoint.savvyReward,
    rewardType: checkpoint.kind === 'join' ? 'savvy_watch_join' : 'savvy_watch_checkpoint',
    note: `Savvy Watch checkpoint — ${checkpoint.label}`,
    meta: { checkpointId, verifiedActiveSeconds: verifiedSeconds },
  });

  if (!result.duplicate) {
    session.checkpointClaims.push(checkpointId);
    await session.save();
  }

  return { ...result, checkpointId, label: checkpoint.label };
}

async function getSessionState(user, slug) {
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Savvy Watch event not found.');
  const session = await SavvyWatchSession.findOne({ eventId: event.eventId, userId: user._id }).lean();
  if (!session) return { joined: false, event: serializeEventPublic(event) };
  return {
    joined: true,
    sessionId: session.sessionId,
    verifiedActiveSeconds: session.verifiedActiveSeconds,
    savvyEarned: session.savvyEarned,
    status: session.status,
    checkpoints: buildCheckpointProgress(event, session),
    event: serializeEventPublic(event),
    participationLabel: 'Verified Event Participation',
  };
}

async function getUserHistory(userId, limit = 20) {
  const sessions = await SavvyWatchSession.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  const eventIds = sessions.map((s) => s.eventId);
  const events = await SavvyWatchEvent.find({ eventId: { $in: eventIds } }).lean();
  const eventMap = Object.fromEntries(events.map((e) => [e.eventId, e]));

  return sessions.map((s) => ({
    eventId: s.eventId,
    title: eventMap[s.eventId]?.title || s.eventId,
    slug: eventMap[s.eventId]?.slug || null,
    verifiedActiveSeconds: s.verifiedActiveSeconds,
    verifiedParticipationMinutes: Math.floor(s.verifiedActiveSeconds / 60),
    savvyEarned: s.savvyEarned,
    votesCast: s.competitionVotes,
    competitionsEntered: s.competitionsEntered,
    joinedAt: s.joinedAt,
    participationLabel: 'Verified Event Participation',
  }));
}

// --- Admin ---

async function createEventFromPreset(adminUser, preset = GTA_CAR_MEET_PRESET, overrides = {}) {
  assertSavvyWatchAccess(adminUser, { adminOk: true });
  const eventId = generateEventId();
  const slug = String(overrides.slug || preset.slug).trim().toLowerCase();

  const existing = await SavvyWatchEvent.findOne({ slug });
  if (existing) throw new SavvyWatchError(409, 'SLUG_EXISTS', 'Event slug already exists.');

  const event = await SavvyWatchEvent.create({
    eventId,
    slug,
    title: overrides.title || preset.title,
    description: overrides.description || preset.description,
    creatorId: adminUser._id,
    platform: overrides.platform || preset.platform || 'youtube',
    platformUrl: overrides.platformUrl || null,
    youtubeVideoId: overrides.youtubeVideoId || null,
    youtubeChannelId: overrides.youtubeChannelId || null,
    status: 'draft',
    rewardBudget: overrides.rewardBudget ?? preset.rewardBudget ?? 0,
    rewardRules: {
      checkpoints: overrides.checkpoints || preset.rewardRules?.checkpoints || DEFAULT_CHECKPOINTS,
      maxSavvyPerViewer: overrides.maxSavvyPerViewer ?? preset.rewardRules?.maxSavvyPerViewer ?? DEFAULT_MAX_SAVVY_PER_VIEWER,
      label: preset.rewardRules?.label || 'Verified Event Participation',
    },
    streamCategory: preset.streamCategory || 'general',
    hostDisplayName: overrides.hostDisplayName || adminUser.username || null,
  });

  for (const comp of preset.competitions || []) {
    await SavvyWatchCompetition.create({
      competitionId: `swcomp_${crypto.randomBytes(8).toString('hex')}`,
      eventId: event.eventId,
      ...comp,
      status: 'draft',
    });
  }

  await logAudit(event.eventId, adminUser._id, 'event_created', { slug, preset: preset.slug });
  return event;
}

async function updateEventStatus(adminUser, slug, status) {
  assertSavvyWatchAccess(adminUser, { adminOk: true });
  const event = await getEventBySlug(slug);
  if (!event) throw new SavvyWatchError(404, 'EVENT_NOT_FOUND', 'Event not found.');

  const updates = { status };
  if (status === 'live' && !event.actualStartAt) updates.actualStartAt = new Date();
  if (status === 'ended') updates.endedAt = new Date();

  await SavvyWatchEvent.updateOne({ eventId: event.eventId }, { $set: updates });
  await logAudit(event.eventId, adminUser._id, `event_${status}`, { status });
  return SavvyWatchEvent.findOne({ eventId: event.eventId }).lean();
}

async function listAdminEvents(adminUser) {
  assertSavvyWatchAccess(adminUser, { adminOk: true });
  return SavvyWatchEvent.find().sort({ createdAt: -1 }).limit(50).lean();
}

module.exports = {
  SavvyWatchError,
  SavvyWatchRewardError,
  assertSavvyWatchAccess,
  getPublicEventPage,
  joinEvent,
  sendHeartbeat,
  claimCheckpoint,
  getSessionState,
  getUserHistory,
  getEventBySlug,
  getParticipantCount,
  serializeEventPublic,
  createEventFromPreset,
  updateEventStatus,
  listAdminEvents,
  logAudit,
};
