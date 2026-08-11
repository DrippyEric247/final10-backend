import React from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Major Quantum Egg discovery reveal — shown once after legitimate unlock.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function QuantumEggRevealModal({ open, onClose }) {
  const reduceMotion = useReducedMotion();

  if (!open) return null;

  return createPortal(
    <motion.div
      className="f10-quantum-reveal-modal"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Quantum Egg discovered"
    >
      <button type="button" className="f10-quantum-reveal-modal__backdrop" aria-label="Close" onClick={onClose} />
      <motion.div
        className="f10-quantum-reveal-modal__panel"
        initial={reduceMotion ? false : { scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      >
        <div className="f10-quantum-reveal-modal__glitch">SYSTEM INTERRUPTION</div>
        <div className="f10-quantum-reveal-modal__signal">UNKNOWN EGG SIGNAL</div>
        <h2 className="f10-quantum-reveal-modal__title">QUANTUM EGG DISCOVERED</h2>
        <p className="f10-quantum-reveal-modal__tagline">BEYOND MYTHIC.</p>
        <p className="f10-quantum-reveal-modal__tagline f10-quantum-reveal-modal__tagline--alt">
          ACROSS THE UNIVERSE.
        </p>
        <p className="f10-quantum-reveal-modal__sub">ONE EGG. EVERY WORLD. ENDLESS POSSIBILITIES.</p>
        <button type="button" className="f10-quantum-reveal-modal__close" onClick={onClose}>
          Continue
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
}
