const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const {
  activeAlertCountQuery,
  initializeAlertSchedule,
  resolveAlertSpeedProfile,
  maybeAccelerateSchedule,
} = require('./alertTimingService');
const { getTierConfigForUser } = require('./betaTesterService');
const { normalizeAlertKeywords } = require('../lib/alertKeywords');
const { auditAlertCreated } = require('./auditLogger');

class AlertLimitError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AlertLimitError';
    this.code = 'ALERT_LIMIT_REACHED';
    this.details = details;
  }
}

/**
 * Count alerts that consume plan capacity (isActive true).
 */
async function countActiveAlerts(userId, session = null) {
  const q = Alert.countDocuments(activeAlertCountQuery(userId));
  return session ? q.session(session) : q;
}

/**
 * Atomically create alert with server-enforced limit (Wave 5).
 */
async function createAlertAuthoritative(userId, user, entitlementDoc, payload) {
  const tierCfg = getTierConfigForUser(user, entitlementDoc);
  const profile = await resolveAlertSpeedProfile(userId, user, entitlementDoc);
  const schedule = initializeAlertSchedule(new Date(), profile);

  const normalizedKeywords = normalizeAlertKeywords(payload.keywords || []);
  if (!normalizedKeywords.length) {
    const err = new Error('At least one keyword is required');
    err.status = 400;
    throw err;
  }

  const baseDoc = {
    user: userId,
    name: payload.name,
    keywords: normalizedKeywords,
    maxPrice: payload.maxPrice,
    minConfidence: payload.minConfidence ?? 70,
    sources: payload.sources || ['ebay'],
    persona: payload.persona || 'buyer',
    kind: payload.kind || 'custom',
    status: payload.status || 'active',
    context: {
      ...(payload.context || {}),
      alertsSpeed: tierCfg.alertsSpeed,
      alertSpeedTier: profile.tier,
      subscriptionTier: tierCfg.id || tierCfg.label,
    },
    ...schedule,
  };

  if (!Number.isFinite(tierCfg.alertsMax)) {
    return Alert.create(baseDoc);
  }

  const session = await mongoose.startSession();
  try {
    let created = null;
    await session.withTransaction(async () => {
      const count = await countActiveAlerts(userId, session);
      if (count >= tierCfg.alertsMax) {
        throw new AlertLimitError(`Alert limit reached for ${tierCfg.label} plan`, {
          alertsMax: tierCfg.alertsMax,
          alertsSpeed: tierCfg.alertsSpeed,
          activeCount: count,
        });
      }
      [created] = await Alert.create([baseDoc], { session });
    });
    return created;
  } finally {
    session.endSession();
  }
}

/**
 * Serialize alert for API with authoritative scheduling fields.
 */
function serializeAlertForClient(alert) {
  if (!alert) return alert;
  const doc = alert.toObject ? alert.toObject() : alert;
  return {
    ...doc,
    effectiveSpeedClass: doc.speedLabel || doc.effectiveSpeedTier || 'Standard',
    activationEstimateMinutes: doc.eligibleAt
      ? Math.max(0, Math.ceil((new Date(doc.eligibleAt).getTime() - Date.now()) / 60000))
      : null,
  };
}

/**
 * Refresh schedule when user tier/perk may have changed (non-destructive).
 */
async function refreshAlertScheduleIfNeeded(alert, userId) {
  const profile = await resolveAlertSpeedProfile(userId);
  const patch = maybeAccelerateSchedule(alert, profile);
  const hasScheduleAccel = Boolean(patch.nextScanAt || patch.eligibleAt);
  if (!hasScheduleAccel && Object.keys(patch).length <= 2) return alert;
  return Alert.findByIdAndUpdate(alert._id, { $set: patch }, { new: true });
}

/**
 * After perk/tier change, accelerate all active alerts for a user (server-only).
 */
async function refreshAllAlertSchedulesForUser(userId) {
  const alerts = await Alert.find({ user: userId, isActive: true });
  if (!alerts.length) return { updated: 0 };
  const profile = await resolveAlertSpeedProfile(userId);
  let updated = 0;
  for (const alert of alerts) {
    const patch = maybeAccelerateSchedule(alert, profile);
    const hasScheduleAccel = Boolean(patch.nextScanAt || patch.eligibleAt);
    if (hasScheduleAccel || patch.effectiveSpeedTier !== alert.effectiveSpeedTier) {
      await Alert.updateOne({ _id: alert._id }, { $set: patch });
      updated += 1;
    }
  }
  return { updated };
}

module.exports = {
  AlertLimitError,
  countActiveAlerts,
  createAlertAuthoritative,
  serializeAlertForClient,
  refreshAlertScheduleIfNeeded,
  refreshAllAlertSchedulesForUser,
};
