/**
 * Cross-app CustomEvent name registry for the Savvy Universe.
 * Values must stay identical to client/src originals until Phase 2 re-exports.
 * @module @savvy/core/events
 */

// Wallet & rewards
export const WALLET_AWARD_EVENT = "f10:savvy-wallet-award";
export const REWARD_EVENT = "f10-reward-event";
export const SAVVY_AUTH_REFRESH_REQUEST = "f10:savvy-auth-refresh-request";
export const SAVVY_STORE_UPDATED = "f10:savvy-store-updated";

// Calling cards
export const CALLING_CARD_UNLOCK_EVENT = "f10:calling-card-unlock";

// Alerts
export const SAVVY_ALERT_EVENT = "f10-savvy-alert-created";

// Scout missions
export const SCOUT_MISSION_SYNC_EVENT = "f10:scout-mission-sync";
export const SCOUT_MISSION_POPUP_EVENT = "f10:scout-mission-popup";
export const SCOUT_MISSION_ACTION_EVENT = "f10:scout-mission-action";

// Battle pass
export const BP_UPDATE_EVENT = "f10-battlepass-update";
export const BP_TIER_COMPLETE_EVENT = "f10-battlepass-tier-complete";
export const BATTLE_PASS_ACTION_EVENT = "f10:battle-pass-action";

/** Frozen map of all Phase 1 universe events (validation / documentation). */
export const UNIVERSE_EVENTS = Object.freeze({
  WALLET_AWARD_EVENT,
  REWARD_EVENT,
  SAVVY_AUTH_REFRESH_REQUEST,
  SAVVY_STORE_UPDATED,
  CALLING_CARD_UNLOCK_EVENT,
  SAVVY_ALERT_EVENT,
  SCOUT_MISSION_SYNC_EVENT,
  SCOUT_MISSION_POPUP_EVENT,
  SCOUT_MISSION_ACTION_EVENT,
  BP_UPDATE_EVENT,
  BP_TIER_COMPLETE_EVENT,
  BATTLE_PASS_ACTION_EVENT,
});
