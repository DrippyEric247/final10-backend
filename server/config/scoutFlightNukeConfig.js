/**
 * Savvy Scout Flight — Nuke Flight Streak + validation (server authority).
 *
 * Keep numeric values in sync with client/src/lib/scoutFlightNukeConfig.js
 * where applicable. This module is the source of truth for payouts and
 * anti-cheat thresholds.
 */

const NUKE_TRIGGER_SECONDS = Number(process.env.SCOUT_FLIGHT_NUKE_TRIGGER_SECONDS) || 1800;
const NUKE_TRIGGER_MS = NUKE_TRIGGER_SECONDS * 1000;

const NUKE_MULTIPLIER_START = 2;
const NUKE_MULTIPLIER_INTERVAL_SECONDS = 60;
const MAX_NUKE_FLIGHT_MULTIPLIER =
  Number(process.env.SCOUT_FLIGHT_MAX_NUKE_MULTIPLIER) || 10;

/** Highest temporary run multiplier that may stack on top of Nuke multiplier. */
const MAX_STACKED_RUN_MULTIPLIER = 2;

const NUKE_ELIGIBLE_REWARD_TYPES = Object.freeze(['coin_value', 'score', 'savvy']);

const NUKE_EXCLUDED_REWARD_TYPES = Object.freeze([
  'scout_flight_ticket',
  'tournament_ticket',
  'cosmetic',
  'calling_card',
  'emblem',
  'camo',
  'account_unlock',
  'egg',
  'battle_pass_skip',
  'one_time_reward',
]);

const NUKE_ACTIVATION_SAVVY = Number(process.env.SCOUT_FLIGHT_NUKE_ACTIVATION_SAVVY) || 500;
const NUKE_SAVVY_PER_MINUTE = Number(process.env.SCOUT_FLIGHT_NUKE_SAVVY_PER_MINUTE) || 100;
const MAX_NUKE_SAVVY_BONUS = Number(process.env.SCOUT_FLIGHT_MAX_NUKE_SAVVY) || 2500;

const NUKE_CLOCK_TOLERANCE_MS = 15 * 1000;
const MAX_NUKE_SURVIVAL_MS = 6 * 60 * 60 * 1000;

/** Mirrors SPAWN_MS in client/src/lib/scoutFlightEngine.js */
const OBSTACLE_SPAWN_INTERVAL_MS = 2200;

/** Gameplay heartbeat cadence (seconds). Client should send near this interval. */
const HEARTBEAT_INTERVAL_SECONDS =
  Number(process.env.SCOUT_FLIGHT_HEARTBEAT_SECONDS) || 15;

/** Allowed silence between heartbeats before final validation gets stricter. */
const HEARTBEAT_GRACE_SECONDS =
  Number(process.env.SCOUT_FLIGHT_HEARTBEAT_GRACE_SECONDS) || 45;

/** Obstacle-count tolerance band around the time-derived expectation. */
const MIN_OBSTACLE_RATIO = Number(process.env.SCOUT_FLIGHT_MIN_OBSTACLE_RATIO) || 0.55;
const MAX_OBSTACLE_RATIO = Number(process.env.SCOUT_FLIGHT_MAX_OBSTACLE_RATIO) || 1.35;

/** @deprecated use MIN_OBSTACLE_RATIO — kept for older imports */
const MIN_OBSTACLE_ESCAPE_RATIO = MIN_OBSTACLE_RATIO;

/** Max client elapsed advance beyond server wall clock per heartbeat. */
const HEARTBEAT_ELAPSED_JUMP_TOLERANCE_MS = 20 * 1000;

/** Max score increase allowed per heartbeat interval (generous for coin bursts). */
const MAX_SCORE_INCREASE_PER_HEARTBEAT = 600;

/** Fractional tolerance when comparing reconstructed vs submitted final score. */
const SCORE_RECONSTRUCTION_TOLERANCE_RATIO = 0.12;

/** Absolute slack on score reconstruction (points). */
const SCORE_RECONSTRUCTION_TOLERANCE_ABSOLUTE = 75;

/** Minimum fraction of expected heartbeats required for long Nuke-eligible runs. */
const MIN_HEARTBEAT_COVERAGE_RATIO = 0.45;

function resolveExpectedObstacleCount(elapsedMs) {
  const ms = Math.max(0, Number(elapsedMs) || 0);
  return Math.floor(ms / OBSTACLE_SPAWN_INTERVAL_MS);
}

function resolveObstacleCountBounds(elapsedMs) {
  const expected = resolveExpectedObstacleCount(elapsedMs);
  return {
    expected,
    min: Math.floor(expected * MIN_OBSTACLE_RATIO),
    max: Math.ceil(expected * MAX_OBSTACLE_RATIO),
  };
}

/** @deprecated prefer resolveObstacleCountBounds */
function resolveMinObstaclesEscaped(elapsedMs) {
  return resolveObstacleCountBounds(elapsedMs).min;
}

function resolveNukeMultiplier(nukeSurvivalMs) {
  const seconds = Math.max(0, Number(nukeSurvivalMs) || 0) / 1000;
  const steps = Math.floor(seconds / NUKE_MULTIPLIER_INTERVAL_SECONDS);
  return Math.min(MAX_NUKE_FLIGHT_MULTIPLIER, NUKE_MULTIPLIER_START + steps);
}

function resolveNukeSavvyBonus(nukeSurvivalMs) {
  const ms = Math.max(0, Number(nukeSurvivalMs) || 0);
  const minutes = Math.floor(ms / 60000);
  const raw = NUKE_ACTIVATION_SAVVY + minutes * NUKE_SAVVY_PER_MINUTE;
  return Math.max(0, Math.min(MAX_NUKE_SAVVY_BONUS, Math.round(raw)));
}

function resolveMaxNukeBonusScore(baseScore, highestMultiplier) {
  const base = Math.max(0, Number(baseScore) || 0);
  const mult = Math.min(
    MAX_NUKE_FLIGHT_MULTIPLIER,
    Math.max(NUKE_MULTIPLIER_START, Number(highestMultiplier) || NUKE_MULTIPLIER_START)
  );
  return Math.ceil(base * (mult * MAX_STACKED_RUN_MULTIPLIER - 1));
}

function resolveMinHeartbeatsForDuration(elapsedMs) {
  const ms = Math.max(0, Number(elapsedMs) || 0);
  if (ms < NUKE_TRIGGER_MS) return 0;
  const expected = Math.floor(ms / (HEARTBEAT_INTERVAL_SECONDS * 1000));
  return Math.max(1, Math.floor(expected * MIN_HEARTBEAT_COVERAGE_RATIO));
}

function isNukeEligibleRewardType(type) {
  return NUKE_ELIGIBLE_REWARD_TYPES.includes(String(type || ''));
}

module.exports = {
  NUKE_TRIGGER_SECONDS,
  NUKE_TRIGGER_MS,
  NUKE_MULTIPLIER_START,
  NUKE_MULTIPLIER_INTERVAL_SECONDS,
  MAX_NUKE_FLIGHT_MULTIPLIER,
  MAX_STACKED_RUN_MULTIPLIER,
  NUKE_ELIGIBLE_REWARD_TYPES,
  NUKE_EXCLUDED_REWARD_TYPES,
  NUKE_ACTIVATION_SAVVY,
  NUKE_SAVVY_PER_MINUTE,
  MAX_NUKE_SAVVY_BONUS,
  NUKE_CLOCK_TOLERANCE_MS,
  MAX_NUKE_SURVIVAL_MS,
  OBSTACLE_SPAWN_INTERVAL_MS,
  MIN_OBSTACLE_ESCAPE_RATIO,
  MIN_OBSTACLE_RATIO,
  MAX_OBSTACLE_RATIO,
  HEARTBEAT_INTERVAL_SECONDS,
  HEARTBEAT_GRACE_SECONDS,
  HEARTBEAT_ELAPSED_JUMP_TOLERANCE_MS,
  MAX_SCORE_INCREASE_PER_HEARTBEAT,
  SCORE_RECONSTRUCTION_TOLERANCE_RATIO,
  SCORE_RECONSTRUCTION_TOLERANCE_ABSOLUTE,
  MIN_HEARTBEAT_COVERAGE_RATIO,
  resolveExpectedObstacleCount,
  resolveObstacleCountBounds,
  resolveMinObstaclesEscaped,
  resolveMinHeartbeatsForDuration,
  resolveNukeMultiplier,
  resolveNukeSavvyBonus,
  resolveMaxNukeBonusScore,
  isNukeEligibleRewardType,
};
