import { registerScoutSupportAction } from './api';

const DEDUPE_MS = 15000;
const recentKeys = new Map();

function dedupeKey(actionType, meta) {
  const id = meta?.listingId || meta?.alertId || meta?.dealId || '';
  return `${actionType}:${id}`;
}

function shouldSend(key) {
  const now = Date.now();
  const last = recentKeys.get(key) || 0;
  if (now - last < DEDUPE_MS) return false;
  recentKeys.set(key, now);
  return true;
}

/** Fire-and-forget Scout Support deal action (deduped per listing/alert). */
export function trackScoutDealAction(actionType, meta = {}) {
  const key = dedupeKey(actionType, meta);
  if (!shouldSend(key)) return Promise.resolve(null);
  return registerScoutSupportAction(actionType, meta).catch(() => null);
}

export function trackBestMoveViewed(meta = {}) {
  return trackScoutDealAction('best_move_viewed', meta);
}

export function trackBestMoveClicked(meta = {}) {
  return trackScoutDealAction('best_move_clicked', meta);
}

export function trackDealSaved(meta = {}) {
  return trackScoutDealAction('deal_saved', meta);
}

export function trackAlertClicked(meta = {}) {
  return trackScoutDealAction('alert_clicked', meta);
}
