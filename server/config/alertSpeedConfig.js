/**
 * Canonical alert speed timing — Wave 5.
 * Maps entitlement alertSpeedTier → server scheduling values.
 *
 * Global cron may poll every ~15 minutes; per-alert nextScanAt/eligibleAt
 * determines when each alert is actually processed.
 */

const ALERT_SPEED_PROFILES = Object.freeze({
  standard: Object.freeze({
    tier: 'standard',
    label: 'Standard',
    activationDelayMinutes: 15,
    minimumRescanMinutes: 15,
    lanePriority: 1,
  }),
  fast: Object.freeze({
    tier: 'fast',
    label: 'Faster',
    activationDelayMinutes: 5,
    minimumRescanMinutes: 10,
    lanePriority: 2,
  }),
  fastest: Object.freeze({
    tier: 'fastest',
    label: 'Fastest',
    activationDelayMinutes: 2,
    minimumRescanMinutes: 5,
    lanePriority: 3,
  }),
});

/** Rare Egg / perk faster-alert effect (server-side only). */
const FASTER_ALERT_PERK = Object.freeze({
  perkBoostKey: 'fasterAlerts',
  activationDelayMultiplier: 0.5,
  minimumRescanMultiplier: 0.5,
  /** Default duration when activated from egg/perk grants (1 hour). */
  defaultDurationMs: 60 * 60 * 1000,
});

function profileForSpeedTier(alertSpeedTier) {
  const t = String(alertSpeedTier || 'standard').toLowerCase();
  if (t === 'fastest' || t === 'priority') return ALERT_SPEED_PROFILES.fastest;
  if (t === 'fast' || t === 'faster') return ALERT_SPEED_PROFILES.fast;
  return ALERT_SPEED_PROFILES.standard;
}

function applyPerkBoost(profile, hasFasterAlertPerk) {
  if (!hasFasterAlertPerk) return profile;
  return {
    ...profile,
    activationDelayMinutes: Math.max(
      1,
      Math.round(profile.activationDelayMinutes * FASTER_ALERT_PERK.activationDelayMultiplier)
    ),
    minimumRescanMinutes: Math.max(
      1,
      Math.round(profile.minimumRescanMinutes * FASTER_ALERT_PERK.minimumRescanMultiplier)
    ),
    perkBoostActive: true,
  };
}

module.exports = {
  ALERT_SPEED_PROFILES,
  FASTER_ALERT_PERK,
  profileForSpeedTier,
  applyPerkBoost,
};
