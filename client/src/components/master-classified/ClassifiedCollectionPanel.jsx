import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, Crown, Eye, EyeOff, Lock, Sparkles, X } from 'lucide-react';
import { getMasterClassifiedAdminPreview } from '../../lib/api';
import useMasterClassifiedCollection from '../../hooks/useMasterClassifiedCollection';
import ClassifiedAdminPreviewCard from './ClassifiedAdminPreviewCard';
import ClassifiedArtworkModal, { ClassifiedItemCard } from './ClassifiedArtworkModal';
import '../../styles/CamoLocker.css';
import '../../styles/MasterClassifiedCollection.css';

function formatSerial(n) {
  if (n == null) return null;
  return `#${String(n).padStart(4, '0')}`;
}

/**
 * Classified / Master Collection detail view inside Universal Camo Locker.
 * @param {{ open: boolean, onClose: () => void, lockerSummary?: object }} props
 */
export default function ClassifiedCollectionPanel({ open, onClose, lockerSummary }) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const scrollRef = useRef(null);
  const [artworkItem, setArtworkItem] = useState(null);
  const [adminPreviewMode, setAdminPreviewMode] = useState(false);
  const [adminPreviewData, setAdminPreviewData] = useState(null);
  const [adminPreviewLoading, setAdminPreviewLoading] = useState(false);

  const {
    loading,
    collection,
    summary,
    items,
    revealRewards,
    collectionSerialNumber,
    unlockSnapshot,
    heroAsset,
    savvyBonusGranted,
    bonusEmblemId,
    bonusCallingCardId,
    adminPreviewAccess,
    reload,
  } = useMasterClassifiedCollection(open);

  useEffect(() => {
    if (!open) {
      setArtworkItem(null);
      setAdminPreviewMode(false);
      setAdminPreviewData(null);
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
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (artworkItem) {
        setArtworkItem(null);
        return;
      }
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, artworkItem, onClose]);

  const statusLabel = useMemo(() => {
    if (!summary) return 'CLASSIFIED';
    if (summary.mastered) return 'MASTERED';
    if (summary.status === 'IN_PROGRESS') return 'IN PROGRESS';
    return 'CLASSIFIED';
  }, [summary]);

  const openArtwork = useCallback((item) => {
    if (item?.imageUrl) setArtworkItem(item);
  }, []);

  const loadAdminPreview = useCallback(async () => {
    setAdminPreviewLoading(true);
    try {
      const data = await getMasterClassifiedAdminPreview();
      setAdminPreviewData(data);
      setAdminPreviewMode(true);
    } catch {
      setAdminPreviewData(null);
      setAdminPreviewMode(false);
    } finally {
      setAdminPreviewLoading(false);
    }
  }, []);

  const toggleAdminPreview = useCallback(async () => {
    if (adminPreviewMode) {
      setAdminPreviewMode(false);
      setArtworkItem(null);
      return;
    }
    await loadAdminPreview();
  }, [adminPreviewMode, loadAdminPreview]);

  const adminPreviewItems = useMemo(
    () => adminPreviewData?.items || [],
    [adminPreviewData]
  );

  const previewItems = useMemo(
    () => items.filter((item) => item.previewWhenLocked && item.imageUrl),
    [items]
  );

  const standardItems = useMemo(
    () => items.filter((item) => !item.previewWhenLocked || revealRewards),
    [items, revealRewards]
  );

  const artworkAdminPreview = Boolean(artworkItem?.adminPreview);

  if (!open) return null;

  return createPortal(
    <motion.div
      className="f10-camo-locker f10-classified-locker"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Classified Collection"
    >
      <button type="button" className="f10-camo-locker__backdrop" aria-label="Close" onClick={onClose} />
      <motion.div
        className="f10-camo-locker__panel f10-classified-locker__panel"
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onClose?.();
        }}
        initial={reduceMotion ? false : { y: '8%' }}
        animate={{ y: 0 }}
        exit={reduceMotion ? undefined : { y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 36 }}
        style={{ '--camo-accent': collection?.accentColor || '#a855f7' }}
      >
        <header className="f10-camo-locker__header f10-classified-locker__header">
          <div
            className="f10-camo-locker__grabber"
            onPointerDown={(e) => dragControls.start(e)}
            role="presentation"
          />
          <div className="f10-classified-locker__title-row">
            <button type="button" className="f10-classified-locker__back" onClick={onClose} aria-label="Back">
              <ChevronLeft size={18} strokeWidth={2.4} />
            </button>
            <div>
              <h2 className="f10-classified-locker__title">{collection?.name || 'CLASSIFIED COLLECTION'}</h2>
              <p className="f10-classified-locker__status">
                STATUS: <span className={`is-${statusLabel.toLowerCase().replace(/\s+/g, '-')}`}>{statusLabel}</span>
                {summary?.mastered ? (
                  <>
                    {' '}
                    · <Check size={12} strokeWidth={3} aria-hidden /> COLLECTION COMPLETE
                  </>
                ) : null}
              </p>
            </div>
            <button type="button" className="f10-camo-locker__close" onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>
          <p className="f10-classified-locker__blurb">{collection?.blurb}</p>
          {adminPreviewAccess ? (
            <div className="f10-classified-admin-controls">
              <button
                type="button"
                className={`f10-classified-admin-controls__toggle ${adminPreviewMode ? 'is-active' : ''}`}
                onClick={toggleAdminPreview}
                disabled={adminPreviewLoading}
              >
                {adminPreviewMode ? (
                  <>
                    <EyeOff size={13} strokeWidth={2.4} aria-hidden /> HIDE MASTER PIECES
                  </>
                ) : (
                  <>
                    <Eye size={13} strokeWidth={2.4} aria-hidden /> VIEW MASTER PIECES
                  </>
                )}
              </button>
              {adminPreviewMode ? (
                <div className="f10-classified-admin-controls__badge" role="status">
                  ADMIN PREVIEW MODE — No rewards are being unlocked.
                </div>
              ) : null}
            </div>
          ) : null}
          {lockerSummary ? (
            <div className="f10-camo-locker__stats f10-classified-locker__stats">
              <div className="f10-camo-stat">
                <span>SAVVY</span>
                <strong>{Number(lockerSummary.savvyPoints || 0).toLocaleString()}</strong>
              </div>
              <div className="f10-camo-stat">
                <span>RANK</span>
                <strong>{lockerSummary.rankLabel || '—'}</strong>
              </div>
              <div className="f10-camo-stat">
                <span>CAMOS</span>
                <strong>
                  {lockerSummary.unlocked}/{lockerSummary.total}
                </strong>
              </div>
            </div>
          ) : null}
        </header>

        <div className="f10-classified-locker__body" ref={scrollRef}>
          {loading && !summary ? (
            <div className="f10-camo-locker__loading">Syncing Classified mastery…</div>
          ) : (
            <div className="f10-classified-locker__layout">
              <aside className="f10-classified-locker__side">
                <div className="f10-classified-bonus">
                  <div className="f10-classified-bonus__head">
                    <Crown size={14} aria-hidden />
                    <span>COLLECTION BONUS</span>
                  </div>
                  <ul>
                    {(collection?.bonuses || []).map((bonus) => (
                      <li key={bonus.id} className={summary?.mastered ? 'is-earned' : ''}>
                        {summary?.mastered ? <Check size={12} aria-hidden /> : <Lock size={10} aria-hidden />}
                        {bonus.label}
                        {bonus.id === 'savvy_bonus' && savvyBonusGranted ? ' ✓' : ''}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`f10-classified-bonus__cta ${summary?.mastered ? 'is-complete' : ''}`}
                    disabled={!summary?.mastered}
                  >
                    {summary?.mastered ? (
                      <>
                        <Check size={14} aria-hidden /> COLLECTION COMPLETE
                      </>
                    ) : (
                      <>
                        <Lock size={12} aria-hidden /> CLASSIFIED
                      </>
                    )}
                  </button>
                </div>

                <div className="f10-classified-progress">
                  <div className="f10-classified-progress__head">
                    <Sparkles size={14} aria-hidden />
                    <span>COLLECTION PROGRESS</span>
                  </div>
                  {(summary?.camoRows || []).map((row) => (
                    <div key={row.camoId} className={`f10-classified-progress__row ${row.complete ? 'is-complete' : ''}`}>
                      <span>{row.camoName.toUpperCase()}</span>
                      <span>
                        {row.unlocked}/{row.total}
                        {row.complete ? ' ✓' : ''}
                      </span>
                      <div className="f10-camo-card__track">
                        <div className="f10-camo-card__fill" style={{ width: `${row.percent}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className={`f10-classified-progress__row is-master ${summary?.mastered ? 'is-complete' : ''}`}>
                    <span>MASTER COLLECTION</span>
                    <span>
                      {summary?.masterUnlocked || 0}/{summary?.masterTotal || 10}
                      {summary?.mastered ? ' ✓' : ''}
                    </span>
                    <div className="f10-camo-card__track">
                      <div className="f10-camo-card__fill" style={{ width: `${summary?.masterPercent || 0}%` }} />
                    </div>
                  </div>
                </div>

                {summary?.mastered && unlockSnapshot ? (
                  <div className="f10-classified-history">
                    <div className="f10-classified-history__head">UNLOCK SNAPSHOT</div>
                    <dl>
                      <div>
                        <dt>Operator</dt>
                        <dd>{unlockSnapshot.username || '—'}</dd>
                      </div>
                      <div>
                        <dt>Level / Prestige</dt>
                        <dd>
                          {unlockSnapshot.accountLevelAtUnlock} / {unlockSnapshot.prestigeAtUnlock}
                        </dd>
                      </div>
                      <div>
                        <dt>Rank</dt>
                        <dd>{unlockSnapshot.rankAtUnlock || '—'}</dd>
                      </div>
                      <div>
                        <dt>Master Serial</dt>
                        <dd>{formatSerial(unlockSnapshot.masterSerial ?? collectionSerialNumber)}</dd>
                      </div>
                      <div>
                        <dt>Earned</dt>
                        <dd>{unlockSnapshot.unlockedAt ? new Date(unlockSnapshot.unlockedAt).toLocaleDateString() : '—'}</dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                {revealRewards ? (
                  <div className="f10-classified-cosmetics">
                    <div className="f10-classified-cosmetics__head">MASTER CALLING CARD & EMBLEM</div>
                    <div className="f10-classified-cosmetics__previews">
                      <div className="f10-classified-cosmetics__card" title={bonusCallingCardId || ''}>
                        <div className="f10-classified-cosmetics__card-art" aria-hidden />
                        <span>CALLING CARD</span>
                      </div>
                      <div className="f10-classified-cosmetics__emblem" title={bonusEmblemId || ''}>
                        <Crown size={20} aria-hidden />
                        <span>EMBLEM</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </aside>

              <main className="f10-classified-locker__main">
                <div className="f10-classified-hero">
                  <img
                    src={heroAsset}
                    alt="Master outfit preview"
                    className="f10-classified-hero__img"
                    loading="eager"
                  />
                  {collectionSerialNumber != null ? (
                    <div className="f10-classified-hero__serial">
                      MASTER {formatSerial(collectionSerialNumber)}
                    </div>
                  ) : null}
                </div>

                <div className="f10-classified-rewards">
                  <div className="f10-classified-rewards__head">MASTER REWARDS</div>
                  {adminPreviewMode ? (
                    <div className="f10-classified-admin-preview">
                      <p className="f10-classified-admin-preview__note">
                        Visual inspection only. Progression and ownership are unchanged.
                      </p>
                      <div className="f10-classified-admin-preview__grid">
                        {adminPreviewItems.map((item) => (
                          <ClassifiedAdminPreviewCard key={item.id} item={item} onPreview={openArtwork} />
                        ))}
                      </div>
                    </div>
                  ) : !revealRewards ? (
                    <>
                      {previewItems.length ? (
                        <div className="f10-classified-preview-section">
                          <div className="f10-classified-preview-section__head">CLASSIFIED PREVIEW</div>
                          <div className="f10-classified-rewards__grid">
                            {previewItems.map((item) => (
                              <ClassifiedItemCard
                                key={item.id}
                                item={item}
                                locked={!item.unlocked}
                                onOpen={openArtwork}
                              />
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="f10-classified-rewards__classified">
                        <Lock size={16} aria-hidden />
                        <p>Complete all six camo families to declassify remaining Master rewards.</p>
                      </div>
                    </>
                  ) : (
                    <div className="f10-classified-rewards__grid">
                      {standardItems.map((item) => (
                        <ClassifiedItemCard
                          key={item.id}
                          item={item}
                          locked={!item.unlocked && !revealRewards}
                          onOpen={openArtwork}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </main>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {artworkItem ? (
          <ClassifiedArtworkModal
            item={artworkItem}
            onClose={() => setArtworkItem(null)}
            adminPreview={artworkAdminPreview}
            summary={adminPreviewData?.summary || summary}
            unlockRequirement={adminPreviewData?.unlockRequirement || ''}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}
