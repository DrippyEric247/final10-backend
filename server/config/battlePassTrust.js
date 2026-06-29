/**
 * Battle Pass event trust boundaries — client HTTP vs server-emitted progression.
 */

const mongoose = require('mongoose');

const DEFAULT_BATTLE_PASS_SEASON_ID = 'neon_hunt_s1';

/** Events clients may POST to /api/progression/events (with scan-deck / bid tokens where required). */
const CLIENT_ALLOWED_EVENT_TYPES = new Set([
  'auction_scanned',
  'bid_placed',
  'auction_won',
  'buy_now_scanned',
  'recommended_deal_viewed',
]);

/** Events only accepted when trustedServerOrigin is set (Savvy ledger, streak claim, etc.). */
const SERVER_ONLY_EVENT_TYPES = new Set([
  'daily_login_claimed',
  'power_boost_claimed',
  'savvy_points_earned',
  'streak_updated',
  'rank_changed',
  'power_multiplier_changed',
]);

const ALL_BATTLE_PASS_EVENT_TYPES = new Set([
  ...CLIENT_ALLOWED_EVENT_TYPES,
  ...SERVER_ONLY_EVENT_TYPES,
]);

function shouldEmitBattlePassProgress() {
  if (process.env.DISABLE_BATTLE_PASS_SERVER_EMIT === 'true') return false;
  if (process.env.JEST_WORKER_ID && process.env.ENABLE_BATTLE_PASS_SERVER_EMIT !== 'true') return false;
  return mongoose.connection.readyState === 1;
}

module.exports = {
  DEFAULT_BATTLE_PASS_SEASON_ID,
  CLIENT_ALLOWED_EVENT_TYPES,
  SERVER_ONLY_EVENT_TYPES,
  ALL_BATTLE_PASS_EVENT_TYPES,
  shouldEmitBattlePassProgress,
};
