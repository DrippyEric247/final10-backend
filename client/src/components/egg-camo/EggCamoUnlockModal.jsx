import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import CamoImage from '../camo/CamoImage';

export default function EggCamoUnlockModal({ item, onClose, onViewCollection }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!item) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="f10-egg-camo-unlock"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Egg Camo unlocked"
      >
        <div className="f10-egg-camo-unlock__backdrop" />
        <motion.div
          className="f10-egg-camo-unlock__panel"
          initial={{ opacity: 0, scale: 0.88, rotateY: -18 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          <motion.div
            className="f10-egg-camo-unlock__egg"
            animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          >
            <CamoImage
              src={item.previewImageUrl || item.imageUrl}
              alt={item.name}
              accentColor={item.accentColor}
              glyph="🥚"
              className="f10-camo-img--hero"
            />
          </motion.div>
          <div className="f10-egg-camo-unlock__burst" aria-hidden />
          <p className="f10-egg-camo-unlock__kicker">CAMO UNLOCKED</p>
          <h2>{item.name.toUpperCase()}</h2>
          <p className="f10-egg-camo-unlock__mastery">{item.masteryLabel.toUpperCase()} COMPLETE</p>
          <p className="f10-egg-camo-unlock__stat">
            {item.rarityCountAtUnlock ?? item.current} {item.eggRarityLabel.toUpperCase()} EGGS COLLECTED
          </p>
          <button type="button" className="f10-camo-btn--primary" onClick={() => onViewCollection?.(item)}>
            VIEW IN COLLECTION
          </button>
          <button type="button" className="f10-camo-btn--ghost f10-egg-camo-unlock__dismiss" onClick={onClose}>
            CONTINUE
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
