/**
 * Savvy Watch — verified event participation (NOT YouTube watch time).
 */
const crypto = require('crypto');
const SavvyWatchSession = require('../models/SavvyWatchSession');
const {
  HEARTBEAT_INTERVAL_SEC,
  HEARTBEAT_GRACE_SEC,
  BACKGROUND_PAUSE_AFTER_SEC,
} = require('../config/savvyWatchConfig');

function secondsBetween(a, b) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 1000));
}

function computeHeartbeatCredit(session, { visible = true, interacted = false, now = new Date() } = {}) {
  const lastHb = session.lastHeartbeatAt ? new Date(session.lastHeartbeatAt) : null;
  if (!lastHb) return { creditSeconds: 0, status: session.status };

  const elapsed = secondsBetween(lastHb, now);
  if (elapsed <= 0) return { creditSeconds: 0, status: session.status };

  const maxCredit = HEARTBEAT_INTERVAL_SEC + HEARTBEAT_GRACE_SEC;
  let creditSeconds = Math.min(elapsed, maxCredit);

  if (!visible) {
    const bgSince = session.backgroundSince ? new Date(session.backgroundSince) : now;
    const bgDuration = secondsBetween(bgSince, now);
    if (bgDuration >= BACKGROUND_PAUSE_AFTER_SEC) {
      creditSeconds = 0;
    } else {
      creditSeconds = Math.floor(creditSeconds * 0.5);
    }
  }

  if (interacted) {
    creditSeconds = Math.min(maxCredit, creditSeconds + 5);
  }

  return {
    creditSeconds,
    status: creditSeconds > 0 ? 'active' : 'inactive',
  };
}

async function processHeartbeat(session, payload = {}) {
  const now = new Date();
  const visible = payload.visible !== false;
  const interacted = Boolean(payload.interacted);

  if (!visible && !session.backgroundSince) {
    session.backgroundSince = now;
  }
  if (visible && session.backgroundSince) {
    session.backgroundSince = null;
  }

  const { creditSeconds, status } = computeHeartbeatCredit(session, { visible, interacted, now });

  if (creditSeconds > 0) {
    session.verifiedActiveSeconds = Math.round(Number(session.verifiedActiveSeconds) || 0) + creditSeconds;
    session.lastPresenceAt = now;
    session.status = 'active';
  } else if (secondsBetween(session.lastPresenceAt || session.joinedAt, now) > HEARTBEAT_GRACE_SEC * 2) {
    session.status = 'inactive';
  } else {
    session.status = status;
  }

  session.lastHeartbeatAt = now;
  await session.save();

  return {
    verifiedActiveSeconds: session.verifiedActiveSeconds,
    status: session.status,
    creditedSeconds: creditSeconds,
    nextHeartbeatSec: HEARTBEAT_INTERVAL_SEC,
    participationLabel: 'Verified Event Participation',
  };
}

async function findOrCreateSession({ eventId, userId, joinSource = 'unknown' }) {
  let session = await SavvyWatchSession.findOne({ eventId, userId });
  if (session) {
    if (session.status === 'completed') {
      session.status = 'active';
      session.lastPresenceAt = new Date();
      await session.save();
    }
    return session;
  }

  session = await SavvyWatchSession.create({
    sessionId: `sws_${crypto.randomBytes(8).toString('hex')}`,
    eventId,
    userId,
    joinSource,
    joinedAt: new Date(),
    lastPresenceAt: new Date(),
    lastHeartbeatAt: null,
    verifiedActiveSeconds: 0,
    status: 'active',
  });

  return session;
}

function buildCheckpointProgress(event, session) {
  const checkpoints = Array.isArray(event?.rewardRules?.checkpoints) ? event.rewardRules.checkpoints : [];
  const claimed = new Set(session?.checkpointClaims || []);
  const verifiedSeconds = Math.round(Number(session?.verifiedActiveSeconds) || 0);

  return checkpoints.map((cp) => {
    const required = Math.round(Number(cp.requiredSeconds) || 0);
    const eligible =
      cp.kind === 'join'
        ? true
        : cp.kind === 'completion'
          ? event.status === 'ended'
          : verifiedSeconds >= required;
    return {
      id: cp.id,
      label: cp.label,
      requiredSeconds: required,
      savvyReward: Math.round(Number(cp.savvyReward) || 0),
      kind: cp.kind || 'presence',
      claimed: claimed.has(cp.id),
      eligible,
      progressSeconds: verifiedSeconds,
    };
  });
}

module.exports = {
  processHeartbeat,
  findOrCreateSession,
  buildCheckpointProgress,
  computeHeartbeatCredit,
};
