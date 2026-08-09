import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { Compass, Sparkles, X } from 'lucide-react';
import EggCamoCard from './EggCamoCard';
import EggCamoPreviewModal from './EggCamoPreviewModal';
import EggCamoUnlockModal from './EggCamoUnlockModal';
import useEggCamoCollection from '../../hooks/useEggCamoCollection';
import { EGG_TIERS } from '../../lib/eggHatchery';
import '../../styles/CamoLocker.css';
import '../../styles/EggCamoCollection.css';

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

const RARITY_LABELS = Object.freeze({
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
});

/**
 * Egg Camo Collection overlay — lifetime Egg rarity mastery progression.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function EggCamoCollectionModal({ open, onClose }) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const scrollRef = useRef(null);
  const [view, setView] = useState('camo');
  const [previewItem, setPreviewItem] = useState(null);
  const [unlockItem, setUnlockItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const shownCelebrations = useRef(new Set());

  const collection = useEggCamoCollection(open);
  const {
    loading,
    items,
    itemsByRarity,
    summary,
    closestCamo,
    collectionMastered,
    pendingUnlockCelebrations,
    reload,
    ackCelebrations,
  } = collection;

  useEffect(() => {
    if (!open) {
      setPreviewItem(null);
      setUnlockItem(null);
      setDetailItem(null);
      shownCelebrations.current.clear();
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    reload({ silent: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, reload]);

  useEffect(() => {
    if (!open || !pendingUnlockCelebrations.length) return;
    const nextId = pendingUnlockCelebrations.find((id) => !shownCelebrations.current.has(id));
    if (!nextId || unlockItem) return;
    const item = items.find((i) => i.id === nextId);
    if (!item) return;
    shownCelebrations.current.add(nextId);
    setUnlockItem(item);
  }, [open, pendingUnlockCelebrations, items, unlockItem]);

  const handleUnlockClose = useCallback(async () => {
    const id = unlockItem?.id;
    setUnlockItem(null);
    if (id) {
      try {
        await ackCelebrations([id]);
      } catch {
        /* cosmetic */
      }
    }
  }, [unlockItem, ackCelebrations]);

  const scoutHint = useMemo(() => {
    if (collectionMastered) return 'EGG CAMO COLLECTION MASTERED — 6 / 6';
    if (!closestCamo) return 'Collect Eggs across every rarity to unlock exclusive Egg Camos.';
    const label = closestCamo.eggRarityLabel || 'Egg';
    return `${closestCamo.name.toUpperCase()} — ${closestCamo.remaining} ${label.toUpperCase()} ${
      closestCamo.remaining === 1 ? 'EGG' : 'EGGS'
    } AWAY`;
  }, [closestCamo, collectionMastered]);

  const raritySections = useMemo(() => {
    return RARITY_ORDER.map((tier) => ({
      tier,
      label: RARITY_LABELS[tier] || tier,
      items: itemsByRarity.get(tier) || [],
      tierMeta: EGG_TIERS.find((t) => t.inventoryKey === tier) || null,
    })).filter((section) => section.items.length > 0);
  }, [itemsByRarity]);

  if (!open) return null;

  const panelMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 48, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 32, scale: 0.985 },
      };

  return createPortal(
    <>
      <motion.div
        className="f10-egg-camo-locker"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="Egg Camo Collection"
      >
        <button type="button" className="f10-egg-camo-locker__backdrop" aria-label="Close" onClick={onClose} />

        <motion.div
          className="f10-egg-camo-locker__panel"
          {...panelMotion}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          drag={reduceMotion ? false : 'y'}
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 140 || info.velocity.y > 750) onClose?.();
          }}
        >
          <header className="f10-egg-camo-locker__header">
            <div
              className="f10-camo-locker__grabber"
              aria-hidden
              onPointerDown={(e) => dragControls.start(e)}
            />
            <div className="f10-egg-camo-locker__title-row">
              <div>
                <h2 className="f10-egg-camo-locker__title">EGG CAMO COLLECTION</h2>
                <p className="f10-egg-camo-locker__tagline">
                  Collect Eggs across each rarity to unlock exclusive Egg Camos.
                </p>
              </div>
              <button type="button" className="f10-camo-locker__close" onClick={onClose} aria-label="Close">
                <X size={19} strokeWidth={2.4} />
              </button>
            </div>

            <div className="f10-camo-locker__stats">
              <div className="f10-camo-stat">
                <span className="f10-camo-stat__label">Camos Unlocked</span>
                <strong className="f10-camo-stat__value">
                  {summary.unlocked} / {summary.total}
                </strong>
              </div>
              <div className="f10-camo-stat">
                <span className="f10-camo-stat__label">Collection</span>
                <strong className="f10-camo-stat__value f10-camo-stat__value--purple">
                  {summary.percent}%
                </strong>
              </div>
              {collectionMastered ? (
                <div className="f10-camo-stat f10-egg-camo-locker__mastered">
                  <span className="f10-camo-stat__label">Status</span>
                  <strong className="f10-camo-stat__value f10-camo-stat__value--gold">MASTERED</strong>
                </div>
              ) : null}
            </div>

            <div className="f10-camo-locker__meter" role="presentation">
              <div className="f10-camo-locker__meter-fill" style={{ width: `${summary.percent}%` }} />
            </div>

            <div className="f10-camo-locker__tabs" role="tablist" aria-label="Browse mode">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'camo'}
                className={`f10-camo-tab ${view === 'camo' ? 'is-active' : ''}`}
                onClick={() => setView('camo')}
              >
                BY CAMO
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'rarity'}
                className={`f10-camo-tab ${view === 'rarity' ? 'is-active' : ''}`}
                onClick={() => setView('rarity')}
              >
                BY EGG RARITY
              </button>
            </div>
          </header>

          <div className="f10-camo-locker__scout">
            <Compass size={14} strokeWidth={2.3} aria-hidden />
            <span>
              <strong>CLOSEST CAMO</strong> — {scoutHint}
            </span>
          </div>

          <div className="f10-egg-camo-locker__body" ref={scrollRef}>
            {loading && !items.some((i) => i.unlocked) ? (
              <div className="f10-camo-locker__loading">Syncing Egg Camo mastery…</div>
            ) : null}

            {detailItem ? (
              <section className="f10-egg-camo-detail">
                <button type="button" className="f10-camo-back" onClick={() => setDetailItem(null)}>
                  ← Collection
                </button>
                <div className="f10-egg-camo-detail__stage">
                  <EggCamoCard
                    item={detailItem}
                    onPreview={() => setPreviewItem(detailItem)}
                    onOpenDetail={() => {}}
                  />
                </div>
                {detailItem.unlockedAt ? (
                  <p className="f10-egg-camo-detail__earned">
                    Unlocked {new Date(detailItem.unlockedAt).toLocaleString()}
                  </p>
                ) : null}
              </section>
            ) : view === 'camo' ? (
              <section className="f10-camo-section">
                <div className="f10-egg-camo-locker__grid">
                  {items.map((item) => (
                    <EggCamoCard
                      key={item.id}
                      item={item}
                      onOpenDetail={setDetailItem}
                      onPreview={setPreviewItem}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <section className="f10-camo-section">
                {raritySections.map((section) => (
                  <div key={section.tier} className="f10-egg-camo-rarity-block">
                    <div className="f10-egg-camo-rarity-block__head">
                      <span
                        className="f10-egg-camo-rarity-block__swatch"
                        style={{
                          '--egg-color': section.tierMeta?.color || '#cbd5e1',
                          '--egg-glow': section.tierMeta?.glow || 'rgba(255,255,255,0.4)',
                        }}
                      />
                      <div>
                        <h3>{section.label.toUpperCase()} EGGS</h3>
                        <p>Mastery unlocks {section.items[0]?.name || 'Egg Camo'}</p>
                      </div>
                    </div>
                    <div className="f10-egg-camo-locker__grid f10-egg-camo-locker__grid--compact">
                      {section.items.map((item) => (
                        <EggCamoCard
                          key={item.id}
                          item={item}
                          onOpenDetail={setDetailItem}
                          onPreview={setPreviewItem}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {collectionMastered ? (
              <div className="f10-egg-camo-master-banner">
                <Sparkles size={16} aria-hidden />
                <span>EGG CAMO COLLECTION — 6 / 6 MASTERED</span>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {previewItem ? (
          <EggCamoPreviewModal
            key={`preview-${previewItem.id}`}
            item={previewItem}
            onClose={() => setPreviewItem(null)}
            onViewCollection={(item) => {
              setPreviewItem(null);
              setDetailItem(item);
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {unlockItem ? (
          <EggCamoUnlockModal
            key={`unlock-${unlockItem.id}`}
            item={unlockItem}
            onClose={handleUnlockClose}
            onViewCollection={(item) => {
              handleUnlockClose();
              setDetailItem(item);
            }}
          />
        ) : null}
      </AnimatePresence>
    </>,
    document.body
  );
}
