import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  INVENTORY_USE_MODAL_Z_INDEX,
  lockPageScrollForInventoryModal,
  unlockPageScrollForInventoryModal,
} from '../../lib/inventoryUseFlow';
import '../../styles/InventoryTokens.css';

export default function TokenActivationModal({
  open,
  def,
  count = 0,
  activating = false,
  isActive = false,
  confirmButtonLabel,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    lockPageScrollForInventoryModal();

    const onKey = (e) => {
      if (e.key === 'Escape' && !activating) onCancel?.();
    };
    window.addEventListener('keydown', onKey, true);

    return () => {
      window.removeEventListener('keydown', onKey, true);
      unlockPageScrollForInventoryModal();
    };
  }, [open, activating, onCancel]);

  if (!open || !def) return null;

  const primaryLabel =
    confirmButtonLabel ||
    def.confirmButtonLabel ||
    (activating ? 'Activating…' : isActive ? 'Extend +30m' : 'Activate Token');

  const modal = (
    <div
      className="f10-token-modal"
      role="dialog"
      aria-modal="true"
      aria-label={def.confirmTitle}
      style={{ zIndex: INVENTORY_USE_MODAL_Z_INDEX }}
      onClick={() => !activating && onCancel?.()}
    >
      <div className="f10-token-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="f10-token-modal__icon" aria-hidden>
          {def.icon}
        </div>
        <h3 className="f10-token-modal__title">{def.confirmTitle}</h3>
        <p className="f10-token-modal__body">{def.confirmBody}</p>
        {count > 0 ? (
          <p className="f10-token-modal__count">You have {count} available.</p>
        ) : null}
        {isActive ? (
          <p className="f10-token-modal__extend">Using another extends the timer by 30 minutes.</p>
        ) : null}
        <div className="f10-token-modal__actions">
          <button
            type="button"
            className="f10-token-modal__btn f10-token-modal__btn--ghost"
            disabled={activating}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="f10-token-modal__btn f10-token-modal__btn--primary"
            disabled={activating || (def.requiresStock !== false && count < 1)}
            onClick={onConfirm}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
