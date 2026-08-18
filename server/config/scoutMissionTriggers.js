/**
 * Scout mission trigger classification — Wave 4 trust boundary.
 */

/** Triggers that should only advance from authoritative server hooks. */
const SERVER_VERIFIABLE_TRIGGERS = new Set([
  'create_alert',
  'add_watchlist',
  'save_deal',
  'savvy_earned_today',
  'battle_pass_tier_up',
  'scan_complete',
]);

/** Client-reportable actions with tighter rate limits (not reward-authoritative). */
const CLIENT_OBSERVABLE_TRIGGERS = new Set([
  'share_deal',
  'travel_profile_complete',
  'save_destination',
  'create_listing',
  'seller_profile_complete',
  'post_win',
  'share_win_proof',
]);

const ALL_KNOWN_TRIGGERS = new Set([
  ...SERVER_VERIFIABLE_TRIGGERS,
  ...CLIENT_OBSERVABLE_TRIGGERS,
]);

/** Max increments per user/trigger/day for client-observable actions. */
const CLIENT_OBSERVABLE_DAILY_CAP = Object.freeze({
  share_deal: 10,
  post_win: 5,
  share_win_proof: 3,
  travel_profile_complete: 2,
  save_destination: 10,
  create_listing: 3,
  seller_profile_complete: 2,
});

function isKnownScoutTrigger(trigger) {
  return ALL_KNOWN_TRIGGERS.has(String(trigger || '').trim());
}

function isServerVerifiableTrigger(trigger) {
  return SERVER_VERIFIABLE_TRIGGERS.has(String(trigger || '').trim());
}

function isClientObservableTrigger(trigger) {
  return CLIENT_OBSERVABLE_TRIGGERS.has(String(trigger || '').trim());
}

function clientObservableDailyCap(trigger) {
  return CLIENT_OBSERVABLE_DAILY_CAP[String(trigger || '').trim()] ?? 5;
}

module.exports = {
  SERVER_VERIFIABLE_TRIGGERS,
  CLIENT_OBSERVABLE_TRIGGERS,
  ALL_KNOWN_TRIGGERS,
  isKnownScoutTrigger,
  isServerVerifiableTrigger,
  isClientObservableTrigger,
  clientObservableDailyCap,
};
