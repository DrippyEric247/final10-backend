/** Founding Tester Program — client helpers (v2 daily missions). */

export const FOUNDING_TESTER_SYNC_EVENT = 'f10:founding-tester-sync';
export const FOUNDING_TESTER_FEEDBACK_MIN = 100;
export const FOUNDING_TESTER_MISSION_COUNT = 7;

const KEYS = {
  ALERT_CREATED: 'f10_founding_tester_alert_created_v1',
};

export function dispatchFoundingTesterSync() {
  try {
    window.dispatchEvent(new Event(FOUNDING_TESTER_SYNC_EVENT));
  } catch {
    /* ignore */
  }
}

/** Call when first alert is successfully created (legacy local signal). */
export function markFoundingTesterAlertCreated() {
  try {
    localStorage.setItem(KEYS.ALERT_CREATED, '1');
  } catch {
    /* ignore */
  }
  dispatchFoundingTesterSync();
}

export function formatFoundingTesterCountdown(ms) {
  const totalMin = Math.ceil(Math.max(0, Number(ms) || 0) / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function formatEstDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}
