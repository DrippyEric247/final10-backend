const STORAGE_KEY = 'f10_inventory_activation';
export const INVENTORY_ACTIVATION_EVENT = 'f10:inventory-token-activated';

export function createActivationIdempotencyKey(itemType) {
  return `inv_${itemType}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function stashActivationPresentation(payload) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...payload, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function readActivationPresentation() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.itemType) return null;
    if (Date.now() - (parsed.ts || 0) > 120000) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActivationPresentation() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function emitInventoryActivated(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(INVENTORY_ACTIVATION_EVENT, { detail }));
}
