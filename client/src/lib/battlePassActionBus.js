import { BATTLE_PASS_ACTION_EVENT } from '@savvy/core/events/universeEvents';

const STORAGE_KEY = 'f10_battle_pass_action_log';

export function emitBattlePassAction(type, payload = {}) {
  const action = {
    id: `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload,
    timestamp: Date.now(),
  };

  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const next = Array.isArray(raw) ? [action, ...raw].slice(0, 100) : [action];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }

  window.dispatchEvent(new CustomEvent(BATTLE_PASS_ACTION_EVENT, { detail: action }));
  return action;
}

export { BATTLE_PASS_ACTION_EVENT };
