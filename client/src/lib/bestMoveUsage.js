/**
 * Server-authoritative Best Move usage (Wave 2 closure).
 * Production enforcement uses POST /api/best-moves/consume — not localStorage.
 */

import { api } from './api';
import {
  DEV_BEST_MOVE_USAGE_RESET_EVENT,
  getBestMoveBoostedCap,
  getEffectiveSubscriptionTier,
  isNonProductionBuild,
} from './tierMultiplier';

export const BEST_MOVE_USAGE_KEY = 'f10_best_move_power_daily_v1';

let serverUsageCache = null;

export function todayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dispatchUsageUpdated() {
  try {
    window.dispatchEvent(new CustomEvent('f10:best-move-usage-updated'));
  } catch {
    /* ignore */
  }
}

export function applyServerBestMoveUsage(payload) {
  if (!payload || typeof payload !== 'object') return;
  serverUsageCache = {
    date: payload.day || todayKey(),
    used: Math.max(0, Number(payload.used) || 0),
    cap: payload.cap ?? null,
    remaining: payload.remaining ?? null,
    unlimited: Boolean(payload.unlimited),
  };
  dispatchUsageUpdated();
}

export async function refreshBestMoveUsageFromServer() {
  try {
    const { data } = await api.get('/best-moves/usage');
    applyServerBestMoveUsage(data);
    return serverUsageCache;
  } catch {
    return null;
  }
}

/** Display/read path — prefers server cache. */
export function readBestMoveUsage() {
  if (serverUsageCache) {
    return {
      date: serverUsageCache.date || todayKey(),
      used: Math.max(0, Number(serverUsageCache.used) || 0),
      cap: serverUsageCache.cap,
      remaining: serverUsageCache.remaining,
      unlimited: Boolean(serverUsageCache.unlimited),
    };
  }
  if (isNonProductionBuild()) {
    try {
      const raw = JSON.parse(localStorage.getItem(BEST_MOVE_USAGE_KEY) || '{}');
      const today = todayKey();
      if (raw.date !== today) return { date: today, used: 0 };
      return { date: today, used: Math.max(0, Number(raw.used) || 0) };
    } catch {
      /* fall through */
    }
  }
  return { date: todayKey(), used: 0 };
}

export function writeBestMoveUsage(used) {
  if (isNonProductionBuild()) {
    try {
      localStorage.setItem(
        BEST_MOVE_USAGE_KEY,
        JSON.stringify({ date: todayKey(), used: Math.max(0, Number(used) || 0) })
      );
    } catch {
      /* ignore */
    }
  }
  if (serverUsageCache) {
    serverUsageCache = { ...serverUsageCache, used: Math.max(0, Number(used) || 0) };
  }
  dispatchUsageUpdated();
}

export function getBestMoveUsedToday() {
  return readBestMoveUsage().used;
}

/**
 * Server-authoritative consume. Returns { ok, used, cap, remaining, unlimited }.
 */
export async function consumeBestMoveCreditServer() {
  try {
    const { data } = await api.post('/best-moves/consume');
    applyServerBestMoveUsage(data);
    import('./scoutSupportTracking')
      .then(({ trackBestMoveClicked }) => {
        trackBestMoveClicked({ source: 'best_move' });
      })
      .catch(() => {});
    return { ok: true, ...data };
  } catch (err) {
    const status = err?.response?.status;
    const body = err?.response?.data || {};
    if (status === 429 || body?.code === 'BEST_MOVE_LIMIT_REACHED') {
      applyServerBestMoveUsage(body);
      return { ok: false, code: 'BEST_MOVE_LIMIT_REACHED', ...body };
    }
    throw err;
  }
}

/** @deprecated Use consumeBestMoveCreditServer in production paths. */
export function tryConsumeBestMoveCredit(tier = getEffectiveSubscriptionTier()) {
  const cap = getBestMoveBoostedCap(tier);
  if (!Number.isFinite(cap)) {
    import('./scoutSupportTracking')
      .then(({ trackBestMoveClicked }) => {
        trackBestMoveClicked({ source: 'best_move' });
      })
      .catch(() => {});
    return true;
  }
  if (!isNonProductionBuild()) return false;
  const usage = readBestMoveUsage();
  if (usage.used >= cap) return false;
  writeBestMoveUsage(usage.used + 1);
  import('./scoutSupportTracking')
    .then(({ trackBestMoveClicked }) => {
      trackBestMoveClicked({ source: 'best_move' });
    })
    .catch(() => {});
  return true;
}

export function formatBestMoveUsageLine(tier = getEffectiveSubscriptionTier()) {
  const usage = readBestMoveUsage();
  const cap = usage.cap ?? getBestMoveBoostedCap(tier);
  const used = usage.used;
  if (usage.unlimited || !Number.isFinite(cap)) return 'Best Moves: Unlimited';
  return `Best Moves: ${used} / ${cap} used today`;
}

export function isBestMoveLimitReached(tier = getEffectiveSubscriptionTier()) {
  const usage = readBestMoveUsage();
  const cap = usage.cap ?? getBestMoveBoostedCap(tier);
  if (usage.unlimited || !Number.isFinite(cap)) return false;
  return usage.used >= cap;
}

export function getBestMoveUpgradePrompt(tier = getEffectiveSubscriptionTier()) {
  if (!isBestMoveLimitReached(tier)) return null;
  const normalized = String(tier || 'free').toLowerCase();
  if (normalized === 'free') {
    return 'Upgrade to Premium for 10 daily Best Moves or Pro for unlimited.';
  }
  if (normalized === 'core' || normalized === 'premium') {
    return 'Upgrade to Pro for unlimited Best Moves.';
  }
  return null;
}

export function subscribeBestMoveUsage(listener) {
  const handler = () => listener(readBestMoveUsage());
  window.addEventListener('f10:best-move-usage-updated', handler);
  window.addEventListener(DEV_BEST_MOVE_USAGE_RESET_EVENT, handler);
  window.addEventListener('f10:subscription-tier-updated', handler);
  window.addEventListener('f10:entitlements-updated', handler);
  return () => {
    window.removeEventListener('f10:best-move-usage-updated', handler);
    window.removeEventListener(DEV_BEST_MOVE_USAGE_RESET_EVENT, handler);
    window.removeEventListener('f10:subscription-tier-updated', handler);
    window.removeEventListener('f10:entitlements-updated', handler);
  };
}

export function clearServerBestMoveUsageCache() {
  serverUsageCache = null;
}
