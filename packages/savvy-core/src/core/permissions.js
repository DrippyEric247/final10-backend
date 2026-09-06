/**
 * Lightweight trusted-app permission registry.
 * @module @savvy/core/core/permissions
 */
import { SAVVY_APP_IDS } from './appRegistry.js';

export const SAVVY_PERMISSIONS = Object.freeze({
  WALLET_EARN: 'wallet.earn',
  WALLET_SPEND: 'wallet.spend',
  XP_AWARD: 'xp.award',
  CONTRACTS_PROGRESS: 'contracts.progress',
  COSMETICS_UNLOCK: 'cosmetics.unlock',
  REWARDS_GRANT: 'rewards.grant',
  EVENTS_EMIT: 'events.emit',
});

/** @type {Readonly<Record<string, readonly string[]>>} */
export const APP_PERMISSIONS = Object.freeze({
  [SAVVY_APP_IDS.FINAL10]: Object.freeze([
    SAVVY_PERMISSIONS.WALLET_EARN,
    SAVVY_PERMISSIONS.WALLET_SPEND,
    SAVVY_PERMISSIONS.XP_AWARD,
    SAVVY_PERMISSIONS.CONTRACTS_PROGRESS,
    SAVVY_PERMISSIONS.COSMETICS_UNLOCK,
    SAVVY_PERMISSIONS.REWARDS_GRANT,
    SAVVY_PERMISSIONS.EVENTS_EMIT,
  ]),
  [SAVVY_APP_IDS.SAVVY_TRIP]: Object.freeze([
    SAVVY_PERMISSIONS.WALLET_EARN,
    SAVVY_PERMISSIONS.XP_AWARD,
    SAVVY_PERMISSIONS.CONTRACTS_PROGRESS,
    SAVVY_PERMISSIONS.COSMETICS_UNLOCK,
    SAVVY_PERMISSIONS.REWARDS_GRANT,
    SAVVY_PERMISSIONS.EVENTS_EMIT,
  ]),
  [SAVVY_APP_IDS.GAME_SAVVY]: Object.freeze([
    SAVVY_PERMISSIONS.WALLET_EARN,
    SAVVY_PERMISSIONS.XP_AWARD,
    SAVVY_PERMISSIONS.CONTRACTS_PROGRESS,
    SAVVY_PERMISSIONS.COSMETICS_UNLOCK,
    SAVVY_PERMISSIONS.REWARDS_GRANT,
    SAVVY_PERMISSIONS.EVENTS_EMIT,
  ]),
  [SAVVY_APP_IDS.SAVVY_WATCH]: Object.freeze([
    SAVVY_PERMISSIONS.WALLET_EARN,
    SAVVY_PERMISSIONS.REWARDS_GRANT,
    SAVVY_PERMISSIONS.EVENTS_EMIT,
  ]),
  [SAVVY_APP_IDS.SAVVY_TRIP_TEST]: Object.freeze([
    SAVVY_PERMISSIONS.WALLET_EARN,
    SAVVY_PERMISSIONS.XP_AWARD,
    SAVVY_PERMISSIONS.CONTRACTS_PROGRESS,
    SAVVY_PERMISSIONS.COSMETICS_UNLOCK,
    SAVVY_PERMISSIONS.REWARDS_GRANT,
    SAVVY_PERMISSIONS.EVENTS_EMIT,
  ]),
  [SAVVY_APP_IDS.GAME_SAVVY_TEST]: Object.freeze([
    SAVVY_PERMISSIONS.WALLET_EARN,
    SAVVY_PERMISSIONS.XP_AWARD,
    SAVVY_PERMISSIONS.CONTRACTS_PROGRESS,
    SAVVY_PERMISSIONS.COSMETICS_UNLOCK,
    SAVVY_PERMISSIONS.REWARDS_GRANT,
    SAVVY_PERMISSIONS.EVENTS_EMIT,
  ]),
});

export function getAppPermissions(appId) {
  const key = String(appId || '').trim().toLowerCase();
  return APP_PERMISSIONS[key] || [];
}

export function assertAppPermission(appId, permission) {
  const perms = getAppPermissions(appId);
  if (!perms.includes(permission)) {
    const err = new Error(`App "${appId}" lacks permission: ${permission}`);
    err.code = 'SAVVY_CORE_PERMISSION_DENIED';
    throw err;
  }
}

export function hasAppPermission(appId, permission) {
  try {
    assertAppPermission(appId, permission);
    return true;
  } catch {
    return false;
  }
}
