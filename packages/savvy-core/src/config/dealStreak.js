/**
 * Deal Streak pacing + milestone configuration.
 * @module @savvy/core/config/dealStreak
 */

/** Minimum ms between streak-counting qualifying deals (anti-spam / no pressure-buying). */
export const DEAL_STREAK_MIN_QUALIFY_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

/** Normal streak count that completes the weekly Savvy Streak contract. */
export const DEAL_STREAK_CONTRACT_MILESTONE = 5;

/** Consecutive same-category deals required for a Nuke camo challenge. */
export const NUKE_CATEGORY_CONSECUTIVE_TARGET = 30;

/** Secret overall qualifying deal streak for Quantum Egg (NOT category camo). */
export const QUANTUM_NUKE_DEAL_STREAK_TARGET = 30;

/** Max streak history entries stored on the user document. */
export const DEAL_STREAK_HISTORY_LIMIT = 100;

/** Authoritative server event name for downstream consumers. */
export const QUALIFYING_DEAL_RECORDED_EVENT = 'f10:qualifying-deal-recorded';

export const DEAL_STREAK_SOURCE_TYPES = Object.freeze([
  'auction_won',
  'deal_purchase',
]);
