/**
 * Beta alert pipeline verification — temporary test mode (remove after launch).
 * Enable with ALERT_TEST_MODE_ENABLED=true on Railway.
 */

const PS5_SEARCH_TERMS = Object.freeze([
  'PS5 Slim Disc',
  'PlayStation 5 Disc Edition',
  'PS5 Console Disc',
  'Sony PS5 Slim',
]);

const TEST_ALERT_NAME = 'Beta Test — PS5 Slim Disc Edition';
const TEST_ALERT_KEYWORDS = Object.freeze(['ps5', 'slim', 'disc']);

/** Relaxed beta triggers (OR logic) */
const BETA_MIN_SAVINGS_PCT = 10;
const BETA_MIN_TRUST_SCORE = 80;
const BETA_MIN_RANKED_ABOVE_PCT = 80;

const MAX_MATCHING_LISTINGS = 3;
const SEARCH_LIMIT_PER_TERM = 10;
const EMAIL_COOLDOWN_MS = 30 * 60 * 1000;

function isAlertTestModeEnabled() {
  return String(process.env.ALERT_TEST_MODE_ENABLED || '').trim().toLowerCase() === 'true';
}

function readPointsEventMultiplier() {
  const raw = String(process.env.POINTS_EVENT_MULTIPLIER || process.env.ALERT_TEST_POINTS_MULTIPLIER || '1').trim();
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(3, Math.floor(n));
}

function isDoubleOrTriplePointsActive() {
  const mult = readPointsEventMultiplier();
  if (mult >= 2) return true;
  return String(process.env.DOUBLE_POINTS_EVENT_ACTIVE || '').trim().toLowerCase() === 'true';
}

module.exports = {
  PS5_SEARCH_TERMS,
  TEST_ALERT_NAME,
  TEST_ALERT_KEYWORDS,
  BETA_MIN_SAVINGS_PCT,
  BETA_MIN_TRUST_SCORE,
  BETA_MIN_RANKED_ABOVE_PCT,
  MAX_MATCHING_LISTINGS,
  SEARCH_LIMIT_PER_TERM,
  EMAIL_COOLDOWN_MS,
  isAlertTestModeEnabled,
  readPointsEventMultiplier,
  isDoubleOrTriplePointsActive,
};
