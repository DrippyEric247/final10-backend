import React from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Premium Nuke category streak completion modal.
 * @param {{ open: boolean, celebration: object|null, onClose: () => void }} props
 */
export default function NukeStreakCompleteModal({ open, celebration, onClose }) {
  const reduceMotion = useReducedMotion();

  if (!open || !celebration) return null;

  const categoryLabel = String(celebration.categoryName || celebration.category || '').toUpperCase();

  return createPortal(
    <motion.div
      className="f10-nuke-complete-modal"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Nuke deal streak complete"
    >
      <button type="button" className="f10-nuke-complete-modal__backdrop" aria-label="Close" onClick={onClose} />
      <motion.div
        className="f10-nuke-complete-modal__panel"
        initial={reduceMotion ? false : { scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <div className="f10-nuke-complete-modal__kicker">NUKE DEAL STREAK COMPLETE</div>
        <div className="f10-nuke-complete-modal__stat">
          {celebration.target || 30} {categoryLabel} DEALS
        </div>
        <p className="f10-nuke-complete-modal__sub">WITHOUT BREAKING CATEGORY</p>
        <div className="f10-nuke-complete-modal__unlock">
          {categoryLabel} NUKE UNLOCKED
        </div>
        <p className="f10-nuke-complete-modal__camo">{celebration.camoName || celebration.camoItemId}</p>
        <button type="button" className="f10-nuke-complete-modal__close" onClick={onClose}>
          Continue
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
}
