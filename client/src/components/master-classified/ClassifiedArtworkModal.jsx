import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, X, ZoomIn } from 'lucide-react';
import { MASTER_CLASSIFIED_DISPLAY_NAME } from '@savvy/core/config/masterClassifiedCollection';

/**
 * Full poster artwork viewer — object-fit contain, no crop.
 * @param {{ item: object|null, onClose: () => void, adminPreview?: boolean, summary?: object|null, unlockRequirement?: string }} props
 */
export default function ClassifiedArtworkModal({
  item,
  onClose,
  adminPreview = false,
  summary = null,
  unlockRequirement = '',
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!item?.imageUrl) return null;

  const lockedPreview = !item.unlocked && !adminPreview;
  const collectionLabel = item.collection === 'classified' ? MASTER_CLASSIFIED_DISPLAY_NAME : item.categoryName;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className={`f10-classified-artwork ${adminPreview ? 'f10-classified-artwork--admin' : ''} ${
          lockedPreview ? 'f10-classified-artwork--locked-preview' : ''
        }`}
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
            <div className="f10-classified-artwork__collection">{collectionLabel}</div>
            <h3>{adminPreview ? `CLASSIFIED MASTER ${item.name}` : item.name}</h3>
            {item.subtitle || item.tagline ? (
              <span className="f10-classified-artwork__tagline">{item.subtitle || item.tagline}</span>
            ) : null}
            {adminPreview ? (
              <>
                <span className="f10-classified-artwork__admin-kicker">ADMIN PREVIEW ONLY</span>
                <span className="f10-classified-artwork__admin-status">
                  Collection Status: {item.collectionStatus || (summary?.mastered ? 'MASTERED' : 'LOCKED / NOT EARNED')}
                </span>
              </>
            ) : lockedPreview ? (
              <>
                <span className="f10-classified-artwork__camo">{item.camoName || 'FUSION WEAVE'}</span>
                <span className="f10-classified-artwork__locked-badge">
                  <Lock size={11} strokeWidth={2.5} aria-hidden /> LOCKED
                </span>
                <span className="f10-classified-artwork__requirement">
                  Requirement: {item.unlockRequirementLabel || 'CLASSIFIED REQUIREMENT'}
                </span>
              </>
            ) : item.unlocked ? (
              <>
                <span className="f10-classified-artwork__camo">{item.camoName || 'FUSION WEAVE'} ACQUIRED</span>
                <span className="f10-classified-artwork__unlocked-badge">{item.name} UNLOCKED</span>
              </>
            ) : (
              <span>Fusion Weave · Gold · Diamond · Dark Nebula</span>
            )}
          </div>
          <div className="f10-classified-artwork__frame f10-classified-artwork__frame--full-brightness">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="f10-classified-artwork__img"
              loading="eager"
            />
          </div>
          {adminPreview ? (
            <div className="f10-classified-artwork__admin-meta">
              {summary ? (
                <div className="f10-classified-artwork__admin-row">
                  <span>Collection progress</span>
                  <strong>
                    {summary.masterUnlocked || 0}/{summary.masterTotal || 10} Master pieces
                    {' · '}
                    {summary.masterPercent || 0}%
                  </strong>
                </div>
              ) : null}
              {unlockRequirement ? (
                <div className="f10-classified-artwork__admin-row">
                  <span>Unlock requirement</span>
                  <strong>{unlockRequirement}</strong>
                </div>
              ) : null}
              {item.assetKey ? (
                <div className="f10-classified-artwork__admin-row">
                  <span>Asset key</span>
                  <strong>{item.assetKey}</strong>
                </div>
              ) : null}
              {item.assetPath ? (
                <div className="f10-classified-artwork__admin-row">
                  <span>Asset path</span>
                  <strong>{item.assetPath}</strong>
                </div>
              ) : null}
              <div className="f10-classified-artwork__admin-row">
                <span>Asset loaded</span>
                <strong>{item.imageUrl ? 'Yes' : 'No'}</strong>
              </div>
            </div>
          ) : null}
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
          {lockedPreview && item.earnedNotBought ? (
            <p className="f10-classified-artwork__earned-note">Digital unlock only — earned, not bought.</p>
          ) : null}
          <button type="button" className="f10-camo-btn--ghost f10-classified-artwork__done" onClick={onClose}>
            {adminPreview ? 'CLOSE PREVIEW' : 'CLOSE'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/** Compact card thumbnail for reward list. */
export function ClassifiedItemCard({ item, locked, onOpen }) {
  const canPreviewLocked = Boolean(item?.previewWhenLocked && item?.imageUrl);
  const canOpen = Boolean(item?.imageUrl) && (!locked || canPreviewLocked);

  return (
    <button
      type="button"
      className={`f10-classified-item ${locked ? 'is-locked' : 'is-unlocked'} ${
        canOpen ? 'is-clickable' : ''
      } ${item?.showcaseArtwork ? 'is-showcase' : ''}`}
      onClick={() => canOpen && onOpen?.(item)}
      disabled={!canOpen}
    >
      <div className="f10-classified-item__thumb">
        {item?.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            className={`f10-classified-item__img ${locked && canPreviewLocked ? 'is-preview' : ''}`}
            loading="lazy"
          />
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
        {locked && canPreviewLocked ? (
          <span className="f10-classified-item__locked-pill">
            <Lock size={10} aria-hidden /> LOCKED
          </span>
        ) : null}
      </div>
      <div className="f10-classified-item__body">
        <div className="f10-classified-item__name">{item?.name || item?.shortName}</div>
        {item?.camoName ? <div className="f10-classified-item__camo">{item.camoName}</div> : null}
        {item?.kind === 'shoe_ticket' && item?.shoeTicketState ? (
          <div className="f10-classified-item__state">{item.shoeTicketState}</div>
        ) : item?.unlocked && item?.serialNumber != null ? (
          <div className="f10-classified-item__serial">#{String(item.serialNumber).padStart(4, '0')}</div>
        ) : locked ? (
          <div className="f10-classified-item__state">
            {item?.unlockRequirementLabel || 'CLASSIFIED'}
          </div>
        ) : null}
      </div>
    </button>
  );
}
