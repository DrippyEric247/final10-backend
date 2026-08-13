/**
 * Shared Perk Machine inventory "Use" UX — viewport-level confirmation modal helpers.
 */

/** Above Savvy Wallet bubble (2147483600) and scout assistant layers. */
export const INVENTORY_USE_MODAL_Z_INDEX = 2147483646;

let scrollLockCount = 0;
let previousBodyOverflow = '';
let previousBodyTouchAction = '';

export function lockPageScrollForInventoryModal() {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }
  scrollLockCount += 1;
}

export function unlockPageScrollForInventoryModal() {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.touchAction = previousBodyTouchAction;
  }
}

/**
 * Open inventory confirmation. Visibility is handled by TokenActivationModal
 * (portaled, position:fixed) — no page scroll jump required.
 * @param {Function} openConfirmation — e.g. (item) => setActivationItem(item)
 * @param {object} item — token def or hatch use def
 */
export function beginInventoryUseConfirmation(openConfirmation, item) {
  if (!item || typeof openConfirmation !== 'function') return;
  openConfirmation(item);
}
