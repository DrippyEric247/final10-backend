import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import CamoImage from './CamoImage';

/**
 * Preview mode for a LOCKED reward. Aspirational, not punitive: the render is
 * shown at full quality with the exact path to earning it. No equip or claim
 * controls exist here by design.
 *
 * @param {object} props
 * @param {object} props.item
 * @param {() => void} props.onClose
 * @param {(item: object) => void} [props.onHowToEarn]
 */
export default function CamoPreviewModal({ item, onClose, onHowToEarn }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (!item) return null;

  const remaining = Math.max(0, item.target - item.current);

  return (
    <motion.div
      className="f10-camo-preview"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} preview`}
      style={{ '--camo-accent': item.accentColor, '--camo-accent-alt': item.accentColorAlt }}
    >
      <button
        type="button"
        className="f10-camo-preview__backdrop"
        aria-label="Close preview"
        onClick={onClose}
      />

      <motion.div
        className={`f10-camo-preview__panel f10-camo-preview__panel--${item.rarity}`}
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <button
          type="button"
          className="f10-camo-preview__close"
          onClick={onClose}
          aria-label="Close preview"
        >
          <X size={18} strokeWidth={2.4} aria-hidden />
        </button>

        <div className="f10-camo-preview__stage">
          <CamoImage
            src={item.previewImageUrl}
            alt={item.name}
            accentColor={item.accentColor}
            loading="eager"
            dimmed
            className="f10-camo-img--hero"
          />
          <span className="f10-camo-preview__watermark">
            <Lock size={12} strokeWidth={2.5} aria-hidden /> Preview Only — Item Not Yet Unlocked
          </span>
        </div>

        <div className="f10-camo-preview__info">
          <div className="f10-camo-preview__rarity">{item.rarityLabel}</div>
          <h3 className="f10-camo-preview__title">{item.name}</h3>
          <div className="f10-camo-preview__sub">
            {item.categoryName} Collection · {item.rewardTypeName}
          </div>

          <div className="f10-camo-preview__progress">
            <div className="f10-camo-preview__progress-head">
              <span>
                {item.current.toLocaleString()} / {item.target.toLocaleString()}{' '}
                {item.categoryName} Deals
              </span>
              <strong>{item.progress}% Complete</strong>
            </div>
            <div className="f10-camo-card__track">
              <div
                className="f10-camo-card__fill"
                style={{ width: `${Math.min(100, item.progress)}%` }}
              />
            </div>
            {remaining > 0 ? (
              <div className="f10-camo-preview__remaining">
                {remaining.toLocaleString()} more to go
              </div>
            ) : null}
          </div>

          {item.gateStatus?.length ? (
            <ul className="f10-camo-preview__gates">
              {item.gateStatus.map((gate) => (
                <li key={gate.label} className={gate.met ? 'is-met' : ''}>
                  <span aria-hidden>{gate.met ? '✓' : '○'}</span> {gate.label}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="f10-camo-preview__actions">
            <button
              type="button"
              className="f10-camo-btn f10-camo-btn--primary"
              onClick={() => onHowToEarn?.(item)}
            >
              HOW TO EARN
            </button>
            <button type="button" className="f10-camo-btn f10-camo-btn--ghost" onClick={onClose}>
              CLOSE PREVIEW
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
