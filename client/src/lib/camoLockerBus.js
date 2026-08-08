/**
 * Universal Camo Locker open/close bus.
 *
 * Any surface in any Savvy app can open the locker without importing the modal
 * or knowing where it is mounted:
 *
 *   import { openCamoLocker } from '../lib/camoLockerBus';
 *   openCamoLocker({ category: 'fitness', source: 'wallet_menu' });
 */

import {
  CAMO_LOCKER_OPEN_EVENT,
  CAMO_LOCKER_CLOSE_EVENT,
  CAMO_LOCKER_SYNC_EVENT,
} from '@savvy/core/events/universeEvents';

export { CAMO_LOCKER_OPEN_EVENT, CAMO_LOCKER_CLOSE_EVENT, CAMO_LOCKER_SYNC_EVENT };

const isDev = process.env.NODE_ENV === 'development';

function dispatch(name, detail) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    /* ignore */
  }
}

/**
 * Open the locker.
 * @param {object} [options]
 * @param {string} [options.category]  deep-link straight into a category
 * @param {string} [options.camo]      deep-link into a camo collection
 * @param {string} [options.itemId]    open a specific item's detail view
 * @param {'category'|'camo'} [options.view] initial browse mode
 * @param {string} [options.source]    where the tap came from (debug only)
 */
export function openCamoLocker(options = {}) {
  const detail = {
    category: options.category || null,
    camo: options.camo || null,
    itemId: options.itemId || null,
    view: options.view || (options.camo ? 'camo' : 'category'),
    source: options.source || 'unknown',
    ts: Date.now(),
  };
  if (isDev) console.info('[CamoLocker] open requested', detail);
  dispatch(CAMO_LOCKER_OPEN_EVENT, detail);
}

export function closeCamoLocker() {
  dispatch(CAMO_LOCKER_CLOSE_EVENT, { ts: Date.now() });
}

/** Ask any mounted locker to re-pull server state (e.g. after a reward grant). */
export function requestCamoLockerSync(reason = 'manual') {
  dispatch(CAMO_LOCKER_SYNC_EVENT, { reason, ts: Date.now() });
}
