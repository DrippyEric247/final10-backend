/**
 * Savvy Predictions — free-entry live predictions (V1).
 * No stakes, wagers, or balance loss. Fixed rewards from event budget only.
 */
const crypto = require('crypto');

const PREDICTION_TYPES = Object.freeze([
  'DRAG_WINNER',
  'DRAG_ET_BRACKET',
  'DRAG_MARGIN_BRACKET',
  'DRIFT_WINNER',
  'DRIFT_TIME_BRACKET',
  'FASTEST_RUN',
]);

const PREDICTION_STATUSES = Object.freeze([
  'draft',
  'open',
  'locked',
  'resolved',
  'cancelled',
  'void',
]);

const ENTRY_OUTCOMES = Object.freeze(['pending', 'correct', 'incorrect', 'void']);

const SAVVY_PREDICTIONS_REWARD_SOURCES = Object.freeze([
  'savvy_prediction_correct',
  'savvy_prediction_bonus',
  'savvy_prediction_streak',
]);

const DEFAULT_PREDICTION_REWARDS = Object.freeze({
  DRAG_WINNER: 10,
  DRAG_ET_BRACKET: 15,
  DRAG_MARGIN_BRACKET: 20,
  DRIFT_WINNER: 10,
  DRIFT_TIME_BRACKET: 15,
  FASTEST_RUN: 25,
});

const DEFAULT_MAX_PREDICTION_SAVVY_PER_USER = 100;

const STREAK_THRESHOLDS = Object.freeze([
  { count: 2, label: 'PICK STREAK x2', bonusSavvy: 5 },
  { count: 3, label: 'PICK STREAK x3', bonusSavvy: 10 },
  { count: 5, label: 'PERFECT READ', bonusSavvy: 15 },
]);

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function isSavvyPredictionsEnabled() {
  return envFlag('SAVVY_PREDICTIONS_ENABLED', false);
}

function isSavvyPredictionsAdminOnly() {
  return envFlag('SAVVY_PREDICTIONS_ADMIN_ONLY', true);
}

function generatePredictionId() {
  return `swp_${crypto.randomBytes(8).toString('hex')}`;
}

function generateOptionId() {
  return `swpo_${crypto.randomBytes(6).toString('hex')}`;
}

function generateEntryId() {
  return `swpe_${crypto.randomBytes(8).toString('hex')}`;
}

function generatePayoutId() {
  return `swpp_${crypto.randomBytes(8).toString('hex')}`;
}

module.exports = {
  PREDICTION_TYPES,
  PREDICTION_STATUSES,
  ENTRY_OUTCOMES,
  SAVVY_PREDICTIONS_REWARD_SOURCES,
  DEFAULT_PREDICTION_REWARDS,
  DEFAULT_MAX_PREDICTION_SAVVY_PER_USER,
  STREAK_THRESHOLDS,
  isSavvyPredictionsEnabled,
  isSavvyPredictionsAdminOnly,
  generatePredictionId,
  generateOptionId,
  generateEntryId,
  generatePayoutId,
};
