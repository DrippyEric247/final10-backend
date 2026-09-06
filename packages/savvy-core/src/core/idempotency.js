/**
 * Canonical idempotency key builder for Savvy Core.
 * @module @savvy/core/core/idempotency
 */
import { validateAppId } from './appRegistry.js';

/**
 * Build a namespaced idempotency key.
 * Pattern: {appId}:{domain}:{userId}:{action}:{uniqueId}
 */
export function buildIdempotencyKey(appId, domain, userId, action, uniqueId = 'default') {
  const app = validateAppId(appId);
  const parts = [
    app,
    String(domain || 'general').trim().toLowerCase(),
    String(userId || '').trim(),
    String(action || 'action').trim().toLowerCase(),
    String(uniqueId || 'default').trim(),
  ];
  return parts.join(':');
}

export const IDEMPOTENCY_DOMAINS = Object.freeze({
  WALLET: 'wallet',
  XP: 'xp',
  REWARD: 'reward',
  CONTRACT: 'contract',
  COSMETIC: 'cosmetic',
  EVENT: 'event',
});
