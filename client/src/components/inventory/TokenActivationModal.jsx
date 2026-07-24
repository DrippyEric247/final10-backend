import React from 'react';
import '../../styles/InventoryTokens.css';

export default function TokenActivationModal({
  open,
  def,
  count = 0,
  activating = false,
  isActive = false,
  onConfirm,
  onCancel,
}) {
  if (!open || !def) return null;

  return (
    <div
      className="f10-token-modal"
      role="dialog"
      aria-modal="true"
      aria-label={def.confirmTitle}
      onClick={() => !activating && onCancel?.()}
    >
      <div className="f10-token-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="f10-token-modal__icon" aria-hidden>
          {def.icon}
        </div>
        <h3 className="f10-token-modal__title">{def.confirmTitle}</h3>
        <p className="f10-token-modal__body">{def.confirmBody}</p>
        <p className="f10-token-modal__count">You have {count} available.</p>
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
            disabled={activating || count < 1}
            onClick={onConfirm}
          >
            {activating ? 'Activating…' : isActive ? 'Extend +30m' : 'Activate Token'}
          </button>
        </div>
      </div>
    </div>
  );
}
