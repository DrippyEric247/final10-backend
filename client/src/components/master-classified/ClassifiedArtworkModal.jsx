import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';

/**
 * Full poster artwork viewer — object-fit contain, no crop.
 * @param {{ item: object|null, onClose: () => void }} props
 */
export default function ClassifiedArtworkModal({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!item?.imageUrl) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="f10-classified-artwork"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} artwork`}
      >
        <button
          type="button"
          className="f10-classified-artwork__backdrop"
          aria-label="Close artwork"
          onClick={onClose}
        />
        <motion.div
          className="f10-classified-artwork__panel"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
          <button type="button" className="f10-classified-artwork__close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>
          <div className="f10-classified-artwork__head">
            <h3>{item.name}</h3>
            <span>Fusion Weave · Gold · Diamond · Dark Nebula</span>
          </div>
          <div className="f10-classified-artwork__frame">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="f10-classified-artwork__img"
              loading="eager"
            />
          </div>
          {item.kind === 'shoe_ticket' ? (
            <div className="f10-classified-artwork__shoe-note">
              <p>{item.shoeTicketCopy || 'Choose your pair. Ship it in. We make it Savvy.'}</p>
              <p className="f10-classified-artwork__shoe-disclaimer">
                {item.shoeTicketDisclaimer ||
                  'Example visualization only — customization applies to your approved compatible pair.'}
              </p>
              {item.shoeTicketState ? (
                <div className="f10-classified-artwork__ticket-state">TICKET · {item.shoeTicketState}</div>
              ) : null}
              {item.masterCollectionSerialNumber != null ? (
                <div className="f10-classified-artwork__serial">
                  MASTER COLLECTION SERIAL · #{String(item.masterCollectionSerialNumber).padStart(4, '0')}
                </div>
              ) : null}
            </div>
          ) : null}
          {item.unlocked && item.serialNumber != null ? (
            <div className="f10-classified-artwork__serial">
              YOUR SERIAL · #{String(item.serialNumber).padStart(4, '0')}
            </div>
          ) : null}
          <button type="button" className="f10-camo-btn--ghost f10-classified-artwork__done" onClick={onClose}>
            CLOSE
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/** Compact card thumbnail for reward list. */
export function ClassifiedItemCard({ item, locked, onOpen }) {
  const canOpen = Boolean(item?.imageUrl) && !locked;
  return (
    <button
      type="button"
      className={`f10-classified-item ${locked ? 'is-locked' : 'is-unlocked'} ${canOpen ? 'is-clickable' : ''}`}
      onClick={() => canOpen && onOpen?.(item)}
      disabled={!canOpen}
    >
      <div className="f10-classified-item__thumb">
        {item?.imageUrl ? (
          <img src={item.imageUrl} alt="" className="f10-classified-item__img" loading="lazy" />
        ) : (
          <div className="f10-classified-item__classified-mark" aria-hidden>
            ?
          </div>
        )}
        {canOpen ? (
          <span className="f10-classified-item__zoom" aria-hidden>
            <ZoomIn size={14} />
          </span>
        ) : null}
      </div>
      <div className="f10-classified-item__body">
        <div className="f10-classified-item__name">{item?.shortName || item?.name}</div>
        {item?.kind === 'shoe_ticket' && item?.shoeTicketState ? (
          <div className="f10-classified-item__state">{item.shoeTicketState}</div>
        ) : item?.unlocked && item?.serialNumber != null ? (
          <div className="f10-classified-item__serial">#{String(item.serialNumber).padStart(4, '0')}</div>
        ) : locked ? (
          <div className="f10-classified-item__state">CLASSIFIED</div>
        ) : null}
      </div>
    </button>
  );
}
