import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import CamoImage from '../camo/CamoImage';

export default function EggCamoPreviewModal({ item, onClose, onViewCollection }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!item) return null;

  const unlocked = Boolean(item.unlocked);

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="f10-egg-camo-preview"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} preview`}
      >
        <button type="button" className="f10-egg-camo-preview__backdrop" aria-label="Close preview" onClick={onClose} />
        <motion.div
          className="f10-egg-camo-preview__panel"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
          <button type="button" className="f10-egg-camo-preview__close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.4} />
          </button>
          <div className="f10-egg-camo-preview__stage">
            <CamoImage
              src={item.previewImageUrl || item.imageUrl}
              alt={item.name}
              accentColor={item.accentColor}
              glyph="🥚"
              className="f10-camo-img--hero f10-egg-camo-preview__artwork"
            />
            {!unlocked ? <div className="f10-egg-camo-preview__watermark">PREVIEW</div> : null}
          </div>
          <div className="f10-egg-camo-preview__copy">
            <h3>{item.name.toUpperCase()}</h3>
            <p>{item.masteryLabel}</p>
            <div className="f10-egg-camo-preview__progress">
              {item.eggRarityLabel} Eggs — {item.current} / {item.target}
            </div>
            <div className="f10-camo-card__track">
              <div className="f10-camo-card__fill" style={{ width: `${item.progress}%` }} />
            </div>
            <p className="f10-egg-camo-preview__req">{item.requirementText}</p>
          </div>
          <div className="f10-egg-camo-preview__actions">
            <button type="button" className="f10-camo-btn--ghost" onClick={onClose}>
              CLOSE
            </button>
            <button type="button" className="f10-camo-btn--primary" onClick={() => onViewCollection?.(item)}>
              VIEW IN COLLECTION
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
