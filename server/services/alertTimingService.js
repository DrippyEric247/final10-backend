/**
 * Server-authoritative alert activation + scan scheduling — Wave 5.
 */
const { resolveUserEntitlements } = require('./userEntitlementService');
const { getEntitlementByUserId } = require('./premiumEntitlementService');
const {
  profileForSpeedTier,
  applyPerkBoost,
  FASTER_ALERT_PERK,
} = require('../config/alertSpeedConfig');

function nowDate(input) {
  return input instanceof Date ? input : new Date(input || Date.now());
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + Math.max(0, Number(minutes) || 0) * 60 * 1000);
}

function hasActiveFasterAlertPerk(user) {
  const boosts = user?.perkMachine?.activeBoosts;
  if (!boosts || typeof boosts !== 'object') return false;
  const entry = boosts[FASTER_ALERT_PERK.perkBoostKey];
  if (!entry) return false;
  const expiresAt = entry.expiresAt ? new Date(entry.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > Date.now();
}

/**
 * Resolve effective alert speed profile from Wave 2 entitlements + optional perk.
 */
async function resolveAlertSpeedProfile(userId, userDoc = null, entitlementDoc = null) {
  const User = require('../models/User');
  const user = userDoc || (await User.findById(userId).lean());
  if (!user) {
    return profileForSpeedTier('standard');
  }
  const ent = entitlementDoc != null ? entitlementDoc : await getEntitlementByUserId(userId);
  const resolved = resolveUserEntitlements(user, ent);
  const base = profileForSpeedTier(resolved.features?.alertSpeedTier);
  return applyPerkBoost(base, hasActiveFasterAlertPerk(user));
}

/**
 * Alerts that count toward plan limit: isActive true (paused toggles isActive off).
 */
function activeAlertCountQuery(userId) {
  return { user: userId, isActive: true };
}

function initializeAlertSchedule(createdAt = new Date(), profile) {
  const created = nowDate(createdAt);
  const eligibleAt = addMinutes(created, profile.activationDelayMinutes);
  return {
    eligibleAt,
    nextScanAt: eligibleAt,
    lastScannedAt: null,
    effectiveSpeedTier: profile.tier,
    speedLabel: profile.label,
  };
}

function isAlertEligibleForScan(alert, at = new Date()) {
  if (!alert?.isActive) return false;
  const now = nowDate(at);
  // Legacy alerts (pre-Wave 5) without schedule fields remain eligible.
  if (!alert.eligibleAt && !alert.nextScanAt) return true;
  const eligibleAt = alert.eligibleAt ? nowDate(alert.eligibleAt) : null;
  if (eligibleAt && eligibleAt.getTime() > now.getTime()) return false;
  const nextScanAt = alert.nextScanAt ? nowDate(alert.nextScanAt) : null;
  if (nextScanAt && nextScanAt.getTime() > now.getTime()) return false;
  return true;
}

function computeNextScanAt(lastScannedAt, profile, at = new Date()) {
  const base = lastScannedAt ? nowDate(lastScannedAt) : nowDate(at);
  return addMinutes(base, profile.minimumRescanMinutes);
}

/**
 * After a scan sweep touches an alert, schedule its next due time.
 */
function scheduleAfterScan(alert, profile, scannedAt = new Date()) {
  const scanned = nowDate(scannedAt);
  return {
    lastScannedAt: scanned,
    nextScanAt: computeNextScanAt(scanned, profile),
    effectiveSpeedTier: profile.tier,
    speedLabel: profile.label,
  };
}

/**
 * Upgrade/downgrade: re-resolve profile and accelerate next scan if tier improved.
 */
function maybeAccelerateSchedule(alert, profile, at = new Date()) {
  const now = nowDate(at);
  const next = alert.nextScanAt ? nowDate(alert.nextScanAt) : null;
  const patch = {
    effectiveSpeedTier: profile.tier,
    speedLabel: profile.label,
  };
  if (!next || next.getTime() > now.getTime()) {
    const accelerated = addMinutes(now, profile.minimumRescanMinutes);
    if (!next || accelerated.getTime() < next.getTime()) {
      patch.nextScanAt = accelerated;
    }
  }
  const eligible = alert.eligibleAt ? nowDate(alert.eligibleAt) : null;
  if (eligible && eligible.getTime() > now.getTime()) {
    const newEligible = addMinutes(alert.createdAt || now, profile.activationDelayMinutes);
    if (newEligible.getTime() < eligible.getTime()) {
      patch.eligibleAt = newEligible;
      if (!alert.lastScannedAt && (!patch.nextScanAt || patch.nextScanAt > newEligible)) {
        patch.nextScanAt = newEligible;
      }
    }
  }
  return patch;
}

/**
 * Activate faster-alert perk on user (egg/perk grants call this).
 * Idempotent when the same idempotencyKey is retried.
 */
async function grantFasterAlertPerk(
  userId,
  durationMs = FASTER_ALERT_PERK.defaultDurationMs,
  source = 'system',
  options = {}
) {
  const User = require('../models/User');
  const { refreshAllAlertSchedulesForUser } = require('./alertCreationService');
  const { idempotencyKey } = options;
  const user = await User.findById(userId).select('perkMachine');
  if (!user) return { ok: false, reason: 'user_not_found' };

  const boostKey = FASTER_ALERT_PERK.perkBoostKey;
  const existing = user?.perkMachine?.activeBoosts?.[boostKey];
  if (idempotencyKey && existing?.idempotencyKey === idempotencyKey) {
    return {
      ok: true,
      expiresAt: existing.expiresAt,
      idempotent: true,
      source: existing.source || source,
    };
  }

  const nowMs = Date.now();
  const existingExpiryMs =
    existing?.expiresAt && new Date(existing.expiresAt).getTime() > nowMs
      ? new Date(existing.expiresAt).getTime()
      : nowMs;
  const expiresAt = new Date(existingExpiryMs + Math.max(60_000, Number(durationMs) || 0));
  const activatedAt =
    existing?.expiresAt && new Date(existing.expiresAt).getTime() > nowMs
      ? existing.activatedAt || new Date()
      : new Date();

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        [`perkMachine.activeBoosts.${boostKey}`]: {
          activatedAt,
          expiresAt,
          source: String(source || 'system'),
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
      },
    }
  );

  await refreshAllAlertSchedulesForUser(userId);

  return { ok: true, expiresAt, idempotent: false };
}

module.exports = {
  hasActiveFasterAlertPerk,
  resolveAlertSpeedProfile,
  activeAlertCountQuery,
  initializeAlertSchedule,
  isAlertEligibleForScan,
  computeNextScanAt,
  scheduleAfterScan,
  maybeAccelerateSchedule,
  grantFasterAlertPerk,
  addMinutes,
};
