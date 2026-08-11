import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { HelpCircle, Key, Lock, Sparkles, X, ZoomIn } from 'lucide-react';
import { EGG_KEYCHAIN_DISPLAY_NAME } from '@savvy/core/config/eggKeychainCollection';
import useEggKeychainCollection from '../../hooks/useEggKeychainCollection';
import { acknowledgeQuantumReveal } from '../../lib/api';
import EggKeychainArtworkModal from './EggKeychainArtworkModal';
import QuantumEggRevealModal from './QuantumEggRevealModal';
import '../../styles/CamoLocker.css';
import '../../styles/EggKeychainCollection.css';

function tierBadge(item) {
  if (item?.classified && !item?.unlocked) return item.lockedBadge || 'CLASSIFIED';
  if (item?.quantumLegacy) return 'QUANTUM';
  if (item?.nukeCollection) return 'NUKE';
  return String(item?.tier || item?.rarity || 'MYTHIC').toUpperCase();
}

/**
 * Egg Keychain Collection overlay — premium physical/digital egg collectibles.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function EggKeychainCollectionModal({ open, onClose }) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const [detailItem, setDetailItem] = useState(null);
  const [quantumRevealOpen, setQuantumRevealOpen] = useState(false);
  const { loading, items, summary, collection, streamHouseNote, state, reload } = useEggKeychainCollection(open);

  useEffect(() => {
    if (!open) {
      setDetailItem(null);
      setQuantumRevealOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !state?.quantum?.pendingReveal) return;
    setQuantumRevealOpen(true);
  }, [open, state?.quantum?.pendingReveal]);

  const handleOpenDetail = useCallback((item) => {
    if (item?.classified && !item?.unlocked && !item?.adminPreview) return;
    if (!item?.imageUrl) return;
    if (!item.unlocked && !item.previewWhenLocked) return;
    setDetailItem(item);
  }, []);

  const handleQuantumRevealClose = useCallback(async () => {
    setQuantumRevealOpen(false);
    try {
      await acknowledgeQuantumReveal();
      await reload({ silent: true });
    } catch {
      /* non-fatal */
    }
  }, [reload]);

  if (!open) return null;

  const tagline = collection?.tagline || '';

  return createPortal(
    <>
      <AnimatePresence>
        <motion.div
          className="f10-egg-keychain-locker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={EGG_KEYCHAIN_DISPLAY_NAME}
        >
          <button type="button" className="f10-egg-keychain-locker__backdrop" aria-label="Close" onClick={onClose} />
          <motion.div
            className="f10-egg-keychain-locker__panel"
            initial={reduceMotion ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag={reduceMotion ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose?.();
            }}
          >
            <div
              className="f10-egg-keychain-locker__handle"
              onPointerDown={(e) => dragControls.start(e)}
              aria-hidden
            />

            <header className="f10-egg-keychain-locker__header">
              <div className="f10-egg-keychain-locker__title-row">
                <div>
                  <h2 className="f10-egg-keychain-locker__title">
                    <Key size={18} aria-hidden /> {EGG_KEYCHAIN_DISPLAY_NAME}
                  </h2>
                  <p className="f10-egg-keychain-locker__tagline">{tagline}</p>
                </div>
                <button type="button" className="f10-camo-locker__close" onClick={onClose} aria-label="Close">
                  <X size={18} strokeWidth={2.4} />
                </button>
              </div>

              <div className="f10-egg-keychain-locker__stats">
                <div className="f10-camo-stat">
                  <span className="f10-camo-stat__label">Owned</span>
                  <span className="f10-camo-stat__value">{summary.owned || 0}</span>
                </div>
                <div className="f10-camo-stat">
                  <span className="f10-camo-stat__label">Locked</span>
                  <span className="f10-camo-stat__value">{summary.locked || 0}</span>
                </div>
                <div className="f10-camo-stat">
                  <span className="f10-camo-stat__label">Tier</span>
                  <span className="f10-camo-stat__value f10-camo-stat__value--gold">PREMIUM</span>
                </div>
              </div>
            </header>

            <div className="f10-egg-keychain-locker__body">
              {loading ? (
                <div className="f10-egg-keychain-locker__loading">Loading keychains…</div>
              ) : (
                <div className="f10-egg-keychain-locker__grid">
                  {items.map((item) => {
                    const isClassified = Boolean(item.classified && !item.unlocked);
                    const canOpen =
                      !isClassified && Boolean(item.imageUrl) && (item.unlocked || item.previewWhenLocked);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`f10-egg-keychain-card ${item.unlocked ? 'is-owned' : 'is-locked'} ${
                          canOpen ? 'is-clickable' : ''
                        } ${item.nukeCollection ? 'f10-egg-keychain-card--nuke' : ''} ${
                          item.quantumLegacy ? 'f10-egg-keychain-card--quantum' : ''
                        } ${isClassified ? 'f10-egg-keychain-card--classified' : ''}`}
                        onClick={() => handleOpenDetail(item)}
                        disabled={!canOpen && !isClassified}
                      >
                        <div
                          className={`f10-egg-keychain-card__thumb ${
                            item.nukeCollection || item.quantumLegacy
                              ? 'f10-egg-keychain-card__thumb--landscape'
                              : ''
                          }`}
                        >
                          {isClassified ? (
                            <div className="f10-egg-keychain-card__classified-mark" aria-hidden>
                              <HelpCircle size={28} />
                              <span>???</span>
                            </div>
                          ) : (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={`f10-egg-keychain-card__img ${!item.unlocked ? 'is-preview' : ''}`}
                              loading="lazy"
                            />
                          )}
                          {!item.unlocked ? (
                            <span className="f10-egg-keychain-card__lock">
                              {isClassified ? (
                                <>
                                  <HelpCircle size={14} aria-hidden /> {item.lockedBadge || 'CLASSIFIED'}
                                </>
                              ) : (
                                <>
                                  <Lock size={14} aria-hidden /> LOCKED
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="f10-egg-keychain-card__owned">
                              <Sparkles size={14} aria-hidden /> ACQUIRED
                            </span>
                          )}
                          {canOpen ? (
                            <span className="f10-egg-keychain-card__zoom" aria-hidden>
                              <ZoomIn size={14} />
                            </span>
                          ) : null}
                        </div>
                        <div className="f10-egg-keychain-card__meta">
                          <h3>{item.name}</h3>
                          <span className="f10-egg-keychain-card__rarity">{tierBadge(item)}</span>
                          {isClassified ? (
                            <span className="f10-egg-keychain-card__classified-req">
                              {item.unlockRule?.lockedRequirementLabel || 'HIDDEN LEGACY'}
                            </span>
                          ) : null}
                          {item.unlocked && item.serialLabel ? (
                            <span className="f10-egg-keychain-card__serial">{item.serialLabel}</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {streamHouseNote ? (
                <p className="f10-egg-keychain-locker__stream-note">{streamHouseNote}</p>
              ) : null}
              {state?.physicalRedemptionNote ? (
                <p className="f10-egg-keychain-locker__stream-note">{state.physicalRedemptionNote}</p>
              ) : null}
            </div>

            <footer className="f10-egg-keychain-locker__footer">
              <button type="button" className="f10-camo-btn--ghost" onClick={() => reload({ silent: true })}>
                REFRESH
              </button>
            </footer>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <EggKeychainArtworkModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        collectionTagline={tagline}
      />

      <QuantumEggRevealModal open={quantumRevealOpen} onClose={handleQuantumRevealClose} />
    </>,
    document.body
  );
}
