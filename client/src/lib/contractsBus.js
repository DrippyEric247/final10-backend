/**
 * Universal Contracts event bus — mirrors Camo Locker pattern.
 */

import {
  CONTRACTS_OPEN_EVENT,
  CONTRACTS_CLOSE_EVENT,
  CONTRACTS_SYNC_EVENT,
} from '@savvy/core/events/universeEvents';

export { CONTRACTS_OPEN_EVENT, CONTRACTS_CLOSE_EVENT, CONTRACTS_SYNC_EVENT };

export const DEFAULT_CONTRACTS_APP_ID = 'final10';

function dispatch(name, detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** @param {{ appId?: string, source?: string, tab?: 'active'|'completed' }} [options] */
export function openContractsHub(options = {}) {
  dispatch(CONTRACTS_OPEN_EVENT, {
    appId: options.appId || DEFAULT_CONTRACTS_APP_ID,
    source: options.source || 'unknown',
    tab: options.tab || 'active',
    ts: Date.now(),
  });
}

export function closeContractsHub() {
  dispatch(CONTRACTS_CLOSE_EVENT, { ts: Date.now() });
}

export function requestContractsSync(reason = 'manual') {
  dispatch(CONTRACTS_SYNC_EVENT, { reason, ts: Date.now() });
}
