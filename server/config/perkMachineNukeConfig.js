/**
 * Perk Machine Nuke Event — secret progression + timed reward multiplier.
 */

/** Lifetime qualifying paid spins required to trigger the first Nuke (V1). */
const PERK_MACHINE_NUKE_SPIN_THRESHOLD = 3000;

/** Default Nuke Mode duration (minutes). Override via env PERK_MACHINE_NUKE_DURATION_MINUTES. */
const DEFAULT_NUKE_DURATION_MINUTES = 30;

function getNukeDurationMinutes() {
  const n = Number(process.env.PERK_MACHINE_NUKE_DURATION_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_NUKE_DURATION_MINUTES;
}

/** Default reward multiplier during Nuke Mode. Override via env PERK_MACHINE_NUKE_MULTIPLIER. */
const DEFAULT_NUKE_MULTIPLIER = 3;

function getNukeMultiplier() {
  const n = Number(process.env.PERK_MACHINE_NUKE_MULTIPLIER);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_NUKE_MULTIPLIER;
}

/** Reward types eligible for Nuke multiplier (after tile multiplier). */
const NUKE_MULTIPLIABLE_REWARD_TYPES = Object.freeze(
  new Set(['savvy', 'egg', 'token', 'streak_shield', 'scout_flight_ticket'])
);

/** Hidden progression milestones — hints only until showProgress is true. */
const NUKE_MILESTONES = Object.freeze([
  { at: 500, id: 'anomaly', message: null, intensity: 1, showProgress: false },
  { at: 1000, id: 'anomaly_detected', message: 'ANOMALY DETECTED', intensity: 2, showProgress: false },
  { at: 2000, id: 'core_instability', message: 'CORE INSTABILITY DETECTED', intensity: 3, showProgress: false },
  { at: 2500, id: 'core_critical', message: 'CORE CRITICAL', intensity: 4, showProgress: true },
  { at: 2900, id: 'threshold_approaching', message: 'NUCLEAR THRESHOLD APPROACHING', intensity: 5, showProgress: true },
  { at: 2999, id: 'core_limit', message: 'CORE LIMIT: 99.9%', intensity: 6, showProgress: true },
]);

/**
 * Which spin modes count toward Nuke progression.
 * V1: successfully completed paid spins with Savvy charged (> 0).
 */
const NUKE_QUALIFYING_RULES = Object.freeze({
  requirePaidSavvy: true,
  countFreeSpins: false,
  countTokenSpins: false,
  countAdminBypass: false,
});

/** V1: auto-trigger thresholds (lifetime qualifying spins). Extend for repeat/seasonal Nukes. */
const NUKE_AUTO_TRIGGER_THRESHOLDS = Object.freeze([3000]);

/**
 * Auto-trigger mode — extensible for future systems.
 * - `lifetime_thresholds`: trigger when lifetime count hits configured thresholds in order
 * - Future: `every_n_spins`, `admin_only`, `seasonal`, etc.
 */
const NUKE_AUTO_TRIGGER_MODE = 'lifetime_thresholds';

/** @deprecated Use NUKE_AUTO_TRIGGER_THRESHOLDS.length for V1 cap */
const NUKE_V1_MAX_AUTO_TRIGGERS = NUKE_AUTO_TRIGGER_THRESHOLDS.length;

function getNextAutoTriggerThreshold(nuke, lifetimeCount) {
  if (NUKE_AUTO_TRIGGER_MODE !== 'lifetime_thresholds') return null;
  const thresholds = [...NUKE_AUTO_TRIGGER_THRESHOLDS].sort((a, b) => a - b);
  const triggered = nuke.nukeEventsTriggered || 0;
  if (triggered >= thresholds.length) return null;
  const nextThreshold = thresholds[triggered];
  if (lifetimeCount !== nextThreshold) return null;
  return nextThreshold;
}

module.exports = {
  PERK_MACHINE_NUKE_SPIN_THRESHOLD,
  DEFAULT_NUKE_DURATION_MINUTES,
  DEFAULT_NUKE_MULTIPLIER,
  getNukeDurationMinutes,
  getNukeMultiplier,
  NUKE_MULTIPLIABLE_REWARD_TYPES,
  NUKE_MILESTONES,
  NUKE_QUALIFYING_RULES,
  NUKE_AUTO_TRIGGER_THRESHOLDS,
  NUKE_AUTO_TRIGGER_MODE,
  NUKE_V1_MAX_AUTO_TRIGGERS,
  getNextAutoTriggerThreshold,
};
