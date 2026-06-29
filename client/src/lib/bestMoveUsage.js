import {
  DEV_BEST_MOVE_USAGE_RESET_EVENT,
  getBestMoveBoostedCap,
  getEffectiveSubscriptionTier,
} from './tierMultiplier';

export const BEST_MOVE_USAGE_KEY = 'f10_best_move_power_daily_v1';

export function todayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function readBestMoveUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(BEST_MOVE_USAGE_KEY) || '{}');
    const today = todayKey();
    if (raw.date !== today) return { date: today, used: 0 };
    return { date: today, used: Math.max(0, Number(raw.used) || 0) };
  } catch {
    return { date: todayKey(), used: 0 };
  }
}

export function writeBestMoveUsage(used) {
  try {
    localStorage.setItem(
      BEST_MOVE_USAGE_KEY,
      JSON.stringify({ date: todayKey(), used: Math.max(0, Number(used) || 0) })
    );
    window.dispatchEvent(new CustomEvent('f10:best-move-usage-updated'));
  } catch {
    /* ignore */
  }
}

export function getBestMoveUsedToday() {
  return readBestMoveUsage().used;
}

/** Returns true when a capped credit was consumed. */
export function tryConsumeBestMoveCredit(tier = getEffectiveSubscriptionTier()) {
  const cap = getBestMoveBoostedCap(tier);
  if (!Number.isFinite(cap)) return true;
  const usage = readBestMoveUsage();
  if (usage.used >= cap) return false;
  writeBestMoveUsage(usage.used + 1);
  return true;
}

export function formatBestMoveUsageLine(tier = getEffectiveSubscriptionTier()) {
  const cap = getBestMoveBoostedCap(tier);
  const used = getBestMoveUsedToday();
  if (!Number.isFinite(cap)) return 'Best Moves: Unlimited';
  return `Best Moves: ${used} / ${cap} used today`;
}

export function isBestMoveLimitReached(tier = getEffectiveSubscriptionTier()) {
  const cap = getBestMoveBoostedCap(tier);
  if (!Number.isFinite(cap)) return false;
  return getBestMoveUsedToday() >= cap;
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
  return () => {
    window.removeEventListener('f10:best-move-usage-updated', handler);
    window.removeEventListener(DEV_BEST_MOVE_USAGE_RESET_EVENT, handler);
    window.removeEventListener('f10:subscription-tier-updated', handler);
  };
}
