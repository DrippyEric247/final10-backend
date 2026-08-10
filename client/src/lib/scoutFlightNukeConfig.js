/**
 * Savvy Scout Flight — Nuke Flight Streak configuration (client).
 *
 * Keep numeric values in sync with server/config/scoutFlightNukeConfig.js.
 * The server is authoritative for anything that pays Savvy; this copy only
 * drives presentation and local (practice) simulation.
 */

/** Continuous active-gameplay seconds required to trigger Nuke Flight. */
export const NUKE_TRIGGER_SECONDS = 1800;

/** Tournament heartbeat cadence — keep in sync with server config. */
export const HEARTBEAT_INTERVAL_SECONDS = 15;
export const HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_SECONDS * 1000;

/** Multiplier awarded the moment Nuke Flight activates. */
export const NUKE_MULTIPLIER_START = 2;

/** Seconds of Nuke survival between each multiplier step. */
export const NUKE_MULTIPLIER_INTERVAL_SECONDS = 60;

/** Economy guardrail — Nuke multiplier can never exceed this. */
export const MAX_NUKE_FLIGHT_MULTIPLIER = 10;

/** Reward kinds the Nuke multiplier is allowed to touch. */
export const NUKE_ELIGIBLE_REWARD_TYPES = Object.freeze(['coin_value', 'score', 'savvy']);

/** Nuke state machine. Exactly one state is active at a time. */
export const NUKE_STATE = Object.freeze({
  NORMAL: 'NORMAL',
  NUKE_WARNING: 'NUKE_WARNING',
  NUKE_ACTIVATION: 'NUKE_ACTIVATION',
  NUKE_ACTIVE: 'NUKE_ACTIVE',
  NUKE_DEATH: 'NUKE_DEATH',
  NUKE_RESULTS: 'NUKE_RESULTS',
});

/**
 * Pre-Nuke anomalies. `at` is total active survival seconds.
 * `message` stays null for the early tiers so the requirement is never spelled out.
 */
export const NUKE_WARNING_STAGES = Object.freeze([
  { at: 1200, id: 'tremor', intensity: 1, message: null },
  { at: 1500, id: 'instability', intensity: 2, message: null },
  { at: 1680, id: 'distant_siren', intensity: 3, message: null },
  { at: 1740, id: 'wrong', intensity: 4, message: null },
  { at: 1770, id: 'warning', intensity: 5, message: null },
  { at: 1790, id: 'imminent', intensity: 6, message: null },
]);

/** Activation cinematic length. Player keeps full control the entire time. */
export const NUKE_ACTIVATION_MS = 2600;

/** Death cinematic length before the results screen appears. */
export const NUKE_DEATH_SEQUENCE_MS = 2200;

/** Visual escalation phases, keyed on Nuke survival seconds. */
export const NUKE_VISUAL_PHASE_THRESHOLDS = Object.freeze([
  { at: 0, id: 'phase1', label: 'NUKE PHASE 1' },
  { at: 60, id: 'phase2', label: 'NUKE PHASE 2' },
  { at: 180, id: 'phase3', label: 'NUKE PHASE 3' },
  { at: 300, id: 'extreme', label: 'EXTREME NUKE' },
]);

/**
 * Controlled difficulty escalation.
 *
 * Only scroll speed scales, and the spawn interval is deliberately left alone.
 * Because time-between-obstacles is `SPAWN_MS` regardless of speed, the player's
 * reaction-time budget and the vertical distance they must cover per gap are
 * unchanged — a faster world is not a less survivable one.
 */
export const NUKE_SPEED_SCALE_MAX = 1.12;
export const NUKE_SPEED_SCALE_RAMP_SECONDS = 240;

/** Obstacle must be this many px clear of Scout before it may be destroyed. */
export const NUKE_DESTRUCTION_SAFE_MARGIN_PX = 48;

/** Debris budgets per quality tier (hard caps; debris never collides). */
export const NUKE_DEBRIS_LIMITS = Object.freeze({
  high: { maxPieces: 90, perObstacle: 7 },
  low: { maxPieces: 28, perObstacle: 3 },
  reduced: { maxPieces: 14, perObstacle: 2 },
});

/** Camera shake amplitude in px per phase, before quality scaling. */
export const NUKE_SHAKE_AMPLITUDE = Object.freeze({
  phase1: 1.6,
  phase2: 2.4,
  phase3: 3.2,
  extreme: 3.8,
});

/** Quality multipliers applied to shake/flash so precision flying stays fair. */
export const NUKE_QUALITY_SCALE = Object.freeze({
  high: 1,
  low: 0.6,
  reduced: 0,
});

/**
 * Nuke survival multiplier for a given Nuke survival duration.
 * @param {number} nukeSurvivalMs
 * @returns {number}
 */
export function resolveNukeMultiplier(nukeSurvivalMs) {
  const seconds = Math.max(0, Number(nukeSurvivalMs) || 0) / 1000;
  const steps = Math.floor(seconds / NUKE_MULTIPLIER_INTERVAL_SECONDS);
  return Math.min(MAX_NUKE_FLIGHT_MULTIPLIER, NUKE_MULTIPLIER_START + steps);
}

/**
 * Visual phase id for a Nuke survival duration.
 * @param {number} nukeSurvivalMs
 */
export function resolveNukeVisualPhase(nukeSurvivalMs) {
  const seconds = Math.max(0, Number(nukeSurvivalMs) || 0) / 1000;
  let phase = NUKE_VISUAL_PHASE_THRESHOLDS[0];
  for (const p of NUKE_VISUAL_PHASE_THRESHOLDS) {
    if (seconds >= p.at) phase = p;
  }
  return phase;
}

/**
 * Highest warning stage reached for a total survival duration, or null.
 * @param {number} survivalMs
 */
export function resolveNukeWarningStage(survivalMs) {
  const seconds = Math.max(0, Number(survivalMs) || 0) / 1000;
  if (seconds >= NUKE_TRIGGER_SECONDS) return null;
  let stage = null;
  for (const s of NUKE_WARNING_STAGES) {
    if (seconds >= s.at) stage = s;
  }
  return stage;
}

/**
 * Scroll-speed scale during Nuke Flight. Ramps to NUKE_SPEED_SCALE_MAX and stops.
 * @param {number} nukeSurvivalMs
 */
export function resolveNukeSpeedScale(nukeSurvivalMs) {
  const seconds = Math.max(0, Number(nukeSurvivalMs) || 0) / 1000;
  const t = Math.min(1, seconds / NUKE_SPEED_SCALE_RAMP_SECONDS);
  return 1 + (NUKE_SPEED_SCALE_MAX - 1) * t;
}

/** @param {'coin_value'|'score'|'savvy'|string} type */
export function isNukeEligibleRewardType(type) {
  return NUKE_ELIGIBLE_REWARD_TYPES.includes(String(type || ''));
}
