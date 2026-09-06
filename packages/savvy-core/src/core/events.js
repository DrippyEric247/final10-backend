/**
 * Lightweight Savvy event envelope — not a full event bus (V1 contract only).
 * @module @savvy/core/core/events
 */
import { validateAppId } from './appRegistry.js';

export const SAVVY_EVENT_TYPES = Object.freeze({
  DEAL_WON: 'DEAL_WON',
  STREAM_PARTICIPATED: 'STREAM_PARTICIPATED',
  PREDICTION_CORRECT: 'PREDICTION_CORRECT',
  TRIP_BOOKED: 'TRIP_BOOKED',
  MATCH_COMPLETED: 'MATCH_COMPLETED',
  LOGIN_COMPLETED: 'LOGIN_COMPLETED',
  CONTRACT_COMPLETED: 'CONTRACT_COMPLETED',
  REWARD_GRANTED: 'REWARD_GRANTED',
});

/**
 * @param {object} params
 * @returns {object}
 */
export function createSavvyEventEnvelope({ eventId, userId, appId, type, metadata = {}, timestamp = new Date() }) {
  validateAppId(appId);
  return {
    eventId: eventId || `sve_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: String(userId),
    appId: String(appId).trim().toLowerCase(),
    type: String(type || '').trim().toUpperCase(),
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  };
}
