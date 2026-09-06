/**
 * Savvy Core V1 — event envelope helper (no full bus).
 */
const crypto = require('crypto');
const {
  validateAppId,
  assertAppPermission,
  SAVVY_PERMISSIONS,
} = require('../../config/savvyCoreConfig');
const SavvyCoreAudit = require('../../models/SavvyCoreAudit');

function createSavvyEventEnvelope({ eventId, userId, appId, type, metadata = {}, timestamp = new Date() }) {
  validateAppId(appId);
  return {
    eventId: eventId || `sve_${crypto.randomBytes(8).toString('hex')}`,
    userId: String(userId),
    appId: String(appId).trim().toLowerCase(),
    type: String(type || '').trim().toUpperCase(),
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  };
}

async function recordSavvyEvent({ userId, appId, type, metadata = {} }) {
  assertAppPermission(appId, SAVVY_PERMISSIONS.EVENTS_EMIT);
  const envelope = createSavvyEventEnvelope({ userId, appId, type, metadata });

  await SavvyCoreAudit.create({
    auditId: `sca_${crypto.randomBytes(8).toString('hex')}`,
    eventId: envelope.eventId,
    userId,
    appId: envelope.appId,
    action: 'event_emit',
    source: envelope.type,
    status: 'completed',
    meta: envelope.metadata,
  }).catch(() => {});

  return envelope;
}

module.exports = {
  createSavvyEventEnvelope,
  recordSavvyEvent,
};
