import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { ChevronRight, Compass, Lock, Shirt, Sparkles, X } from 'lucide-react';
import CamoItemCard from './CamoItemCard';
import CamoPreviewModal from './CamoPreviewModal';
import CamoDetailPanel from './CamoDetailPanel';
import CamoImage from './CamoImage';
import useCamoLocker from '../../hooks/useCamoLocker';
import { getApparelType, getCategoryRewardTypes } from '@savvy/core/config/camoLocker';
import { claimCamoReward, getNukeCollectionPreview } from '../../lib/api';
import { requestCamoLockerSync } from '../../lib/camoLockerBus';
import '../../styles/CamoLocker.css';

const isDev = process.env.NODE_ENV === 'development';

function devLog(...args) {
  if (isDev) console.info('[CamoLocker]', ...args);
}

/**
 * UNIVERSAL SAVVY CAMO LOCKER
 *
 * A self-contained overlay that any Savvy Universe app can mount once and open
 * from anywhere via `openCamoLocker()`. It renders above the current page and
 * never navigates, so the underlying app state is preserved.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {{category?: string, camo?: string, itemId?: string, view?: 'category'|'camo'}} [props.intent]
 */
export default function SavvyCamoLocker({ open, onClose, intent }) {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const scrollRef = useRef(null);

  const locker = useCamoLocker(open);
  const {
    authed,
    loading,
    items,
    itemsById,
    summary,
    categories,
    upcomingCategories,
    collections,
    camoTiers,
    nearestUnlock,
    reload,
    markSeen,
    nukePreviewAccess,
  } = locker;

  const [nukePreview, setNukePreview] = useState(null);

  const [view, setView] = useState('category');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRewardType, setSelectedRewardType] = useState(null);
  const [selectedCamo, setSelectedCamo] = useState(null);
  const [detailItemId, setDetailItemId] = useState(null);
  const [previewItemId, setPreviewItemId] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const detailItem = detailItemId ? itemsById.get(detailItemId) || null : null;
  const previewItem = previewItemId ? itemsById.get(previewItemId) || null : null;

  /* -------------------------------- lifecycle ------------------------------ */

  // Apply the deep-link intent each time the locker is opened.
  useEffect(() => {
    if (!open) return;
    setView(intent?.view || (intent?.camo ? 'camo' : 'category'));
    setSelectedCategory(intent?.category || null);
    setSelectedRewardType(intent?.rewardType || null);
    setSelectedCamo(intent?.camo || null);
    setDetailItemId(intent?.itemId || null);
    setPreviewItemId(null);
    devLog('opened', { source: intent?.source || 'unknown', view: intent?.view || 'category' });
  }, [open, intent]);

  // Lock page scroll while open so the app underneath stays put.
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !nukePreviewAccess) {
      setNukePreview(null);
      return undefined;
    }
    let cancelled = false;
    getNukeCollectionPreview()
      .then((data) => {
        if (!cancelled) setNukePreview(data);
      })
      .catch(() => {
        if (!cancelled) setNukePreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, nukePreviewAccess]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (previewItemId) {
        setPreviewItemId(null);
        return;
      }
      onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, previewItemId, onClose]);

  // Clear NEW ribbons for whatever the user is actually looking at.
  useEffect(() => {
    if (!open || !authed) return;
    const visibleNew = items.filter((i) => i.isNew && i.unlocked).map((i) => i.id);
    if (visibleNew.length) markSeen(visibleNew);
  }, [open, authed, items, markSeen]);

  // Reset scroll on every navigation step.
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0, behavior: 'auto' });
  }, [view, selectedCategory, selectedRewardType, selectedCamo, detailItemId]);

  /* --------------------------------- actions ------------------------------- */

  const openDetail = useCallback((item) => {
    devLog('detail opened:', item.id, '| unlock state:', item.unlocked ? 'unlocked' : 'locked');
    setPreviewItemId(null);
    setDetailItemId(item.id);
  }, []);

  const openPreview = useCallback((item) => {
    devLog('preview opened:', item.id, '| unlock state: locked');
    setPreviewItemId(item.id);
  }, []);

  const handleHowToEarn = useCallback((item) => {
    setPreviewItemId(null);
    setDetailItemId(item.id);
  }, []);

  const handleClaim = useCallback(
    async (item) => {
      if (!item?.unlocked || item.claimedAt) return;
      setClaiming(true);
      try {
        await claimCamoReward(item.id);
        await reload({ silent: true });
        requestCamoLockerSync('claim');
        devLog('claim recorded:', item.id);
      } catch (err) {
        devLog('claim failed:', err?.message || err);
      } finally {
        setClaiming(false);
      }
    },
    [reload]
  );

  const selectCategory = useCallback((categoryId) => {
    devLog('category selected:', categoryId);
    setSelectedCategory(categoryId);
    setSelectedRewardType(null);
    setDetailItemId(null);
  }, []);

  const selectCamo = useCallback((camoId) => {
    devLog('camo selected:', camoId);
    setSelectedCamo(camoId);
    setDetailItemId(null);
  }, []);

  const goBack = useCallback(() => {
    if (detailItemId) {
      setDetailItemId(null);
      return;
    }
    if (view === 'category' && selectedCategory) {
      setSelectedCategory(null);
      return;
    }
    if (view === 'camo' && selectedCamo) {
      setSelectedCamo(null);
    }
  }, [detailItemId, view, selectedCategory, selectedCamo]);

  const switchView = useCallback((nextView) => {
    setView(nextView);
    setSelectedCategory(null);
    setSelectedRewardType(null);
    setSelectedCamo(null);
    setDetailItemId(null);
    devLog('browse mode:', nextView);
  }, []);

  /* --------------------------------- derived ------------------------------- */

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategory) || null,
    [categories, selectedCategory]
  );

  /** Retail Hoodies admin view merges the public outdoor ladder with the private Nuke Hoodie. */
  const categoryDisplayItems = useMemo(() => {
    if (!activeCategory) return [];
    const rewardTypes = getCategoryRewardTypes(activeCategory);
    const rewardType = selectedRewardType || rewardTypes[0] || activeCategory.rewardType;
    if (activeCategory.id === 'retail' && rewardType === 'hoodie' && nukePreviewAccess) {
      const outdoorHoodies = items
        .filter((i) => i.category === 'outdoor' && i.rewardType === 'hoodie')
        .sort((a, b) => a.order - b.order);
      const retailHoodies = activeCategory.items
        .filter((i) => i.rewardType === 'hoodie')
        .sort((a, b) => a.order - b.order);
      return [...outdoorHoodies, ...retailHoodies];
    }
    return activeCategory.items
      .filter((i) => !rewardTypes.length || i.rewardType === rewardType)
      .sort((a, b) => a.order - b.order);
  }, [activeCategory, items, nukePreviewAccess, selectedRewardType]);

  const categoryRewardTabs = useMemo(() => {
    if (!activeCategory) return [];
    const rewardTypes = getCategoryRewardTypes(activeCategory);
    if (rewardTypes.length <= 1) return [];
    return rewardTypes
      .map((typeId) => {
        const apparel = getApparelType(typeId);
        const visibleCount =
          typeId === 'hoodie' && activeCategory.id === 'retail' && nukePreviewAccess
            ? items.filter((i) => i.category === 'outdoor' && i.rewardType === 'hoodie').length +
              activeCategory.items.filter((i) => i.rewardType === 'hoodie').length
            : activeCategory.items.filter((i) => i.rewardType === typeId).length;
        return {
          id: typeId,
          label: (apparel?.plural || typeId).toUpperCase(),
          visibleCount,
        };
      })
      .filter((tab) => tab.visibleCount > 0);
  }, [activeCategory, items, nukePreviewAccess]);

  const activeRewardType = useMemo(() => {
    if (!activeCategory) return null;
    const rewardTypes = getCategoryRewardTypes(activeCategory);
    if (!rewardTypes.length) return activeCategory.rewardType;
    if (selectedRewardType && categoryRewardTabs.some((t) => t.id === selectedRewardType)) {
      return selectedRewardType;
    }
    return categoryRewardTabs[0]?.id || rewardTypes[0];
  }, [activeCategory, categoryRewardTabs, selectedRewardType]);

  const activeRewardTypeLabel = useMemo(() => {
    if (!activeRewardType) return activeCategory?.items[0]?.rewardTypePlural || '';
    return getApparelType(activeRewardType)?.plural || activeRewardType;
  }, [activeCategory, activeRewardType]);

  const activeCamoCollection = useMemo(
    () => collections.find((c) => c.camo === selectedCamo) || null,
    [collections, selectedCamo]
  );

  const scoutHint = useMemo(() => {
    if (!authed) return 'Sign in to sync your locker across every Savvy app.';
    if (!nearestUnlock) return 'Full collection secured, Operator. Seasonal drops are next.';
    const remaining = Math.max(0, nearestUnlock.target - nearestUnlock.current);
    if (!nearestUnlock.gatesMet) {
      return `${nearestUnlock.name} needs one more milestone before it can drop.`;
    }
    if (remaining <= 0) return `${nearestUnlock.name} is ready to unlock.`;
    return `You're closest to ${nearestUnlock.name} — ${remaining.toLocaleString()} ${nearestUnlock.categoryName} deals away.`;
  }, [authed, nearestUnlock]);

  if (!open) return null;

  const panelMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 48, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 32, scale: 0.985 },
      };

  return createPortal(
    <motion.div
      className="f10-camo-locker"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.12 : 0.24 }}
      role="dialog"
      aria-modal="true"
      aria-label="Savvy Camo Locker"
    >
      <button
        type="button"
        className="f10-camo-locker__backdrop"
        aria-label="Close Camo Locker"
        onClick={onClose}
      />

      <motion.div
        className="f10-camo-locker__panel"
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
        <header className="f10-camo-locker__header">
          <div
            className="f10-camo-locker__grabber"
            aria-hidden
            onPointerDown={(e) => dragControls.start(e)}
          />

          <div className="f10-camo-locker__title-row">
            <div className="f10-camo-locker__brand">
              <span className="f10-camo-locker__mark" aria-hidden>
                <Shirt size={17} strokeWidth={2.2} />
              </span>
              <div>
                <h2 className="f10-camo-locker__title">SAVVY CAMO LOCKER</h2>
                <p className="f10-camo-locker__tagline">“Earn it. Wear it. Represent.”</p>
              </div>
            </div>
            <button
              type="button"
              className="f10-camo-locker__close"
              onClick={onClose}
              aria-label="Close Camo Locker"
            >
              <X size={19} strokeWidth={2.4} aria-hidden />
            </button>
          </div>

          <div className="f10-camo-locker__stats">
            <div className="f10-camo-stat">
              <span className="f10-camo-stat__label">Savvy</span>
              <strong className="f10-camo-stat__value f10-camo-stat__value--gold">
                {summary.savvyPoints.toLocaleString()}
              </strong>
            </div>
            <div className="f10-camo-stat">
              <span className="f10-camo-stat__label">Rank</span>
              <strong className="f10-camo-stat__value" style={{ color: summary.rankColor }}>
                {summary.rankLabel}
              </strong>
            </div>
            <div className="f10-camo-stat">
              <span className="f10-camo-stat__label">Camos</span>
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
          </div>

          <div className="f10-camo-locker__meter" role="presentation">
            <div className="f10-camo-locker__meter-fill" style={{ width: `${summary.percent}%` }} />
          </div>

          <div className="f10-camo-locker__tabs" role="tablist" aria-label="Browse mode">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'category'}
              className={`f10-camo-tab ${view === 'category' ? 'is-active' : ''}`}
              onClick={() => switchView('category')}
            >
              BY CATEGORY
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'camo'}
              className={`f10-camo-tab ${view === 'camo' ? 'is-active' : ''}`}
              onClick={() => switchView('camo')}
            >
              BY CAMO
            </button>
          </div>
        </header>

        <div className="f10-camo-locker__scout">
          <Compass size={14} strokeWidth={2.3} aria-hidden />
          <span>{scoutHint}</span>
        </div>

        <div className="f10-camo-locker__body" ref={scrollRef}>
          {loading && !items.some((i) => i.unlocked) ? (
            <div className="f10-camo-locker__loading">Syncing your locker…</div>
          ) : null}

          <AnimatePresence mode="wait" initial={false}>
            {detailItem ? (
              <CamoDetailPanel
                key={`detail-${detailItem.id}`}
                item={detailItem}
                items={items}
                onBack={goBack}
                onSelectItem={openDetail}
                onClaim={handleClaim}
                claiming={claiming}
              />
            ) : view === 'category' && activeCategory ? (
              <motion.section
                key={`cat-${activeCategory.id}`}
                className="f10-camo-section"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <button type="button" className="f10-camo-back" onClick={goBack}>
                  ← All Categories
                </button>
                <div className="f10-camo-section__head">
                  <h3>
                    {activeCategory.name.toUpperCase()}
                    <span>{activeRewardTypeLabel}</span>
                  </h3>
                  <div className="f10-camo-section__meta">
                    {activeCategory.unlocked} / {activeCategory.total} Camos Unlocked
                    {activeCategory.highestCamo ? ` · Highest: ${activeCategory.highestCamo}` : ''}
                  </div>
                </div>
                {categoryRewardTabs.length > 1 ? (
                  <div
                    className="f10-camo-locker__tabs f10-camo-locker__tabs--sub"
                    role="tablist"
                    aria-label={`${activeCategory.name} apparel types`}
                  >
                    {categoryRewardTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeRewardType === tab.id}
                        className={`f10-camo-tab ${activeRewardType === tab.id ? 'is-active' : ''}`}
                        onClick={() => {
                          setSelectedRewardType(tab.id);
                          setDetailItemId(null);
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="f10-camo-grid">
                  {categoryDisplayItems.map((item) => (
                    <CamoItemCard
                      key={item.id}
                      item={item}
                      onOpenDetail={openDetail}
                      onPreview={openPreview}
                    />
                  ))}
                </div>
              </motion.section>
            ) : view === 'camo' && activeCamoCollection ? (
              <motion.section
                key={`camo-${activeCamoCollection.camo}`}
                className="f10-camo-section"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <button type="button" className="f10-camo-back" onClick={goBack}>
                  ← All Camos
                </button>
                <div className="f10-camo-section__head">
                  <h3>
                    {activeCamoCollection.camoName.toUpperCase()}
                    <span>{activeCamoCollection.rarityLabel}</span>
                  </h3>
                  <div className="f10-camo-section__meta">
                    {activeCamoCollection.unlocked} / {activeCamoCollection.total} pieces ·{' '}
                    {activeCamoCollection.percent}% complete
                  </div>
                </div>
                <div className="f10-camo-grid">
                  {activeCamoCollection.items.map((item) => (
                    <CamoItemCard
                      key={item.id}
                      item={item}
                      showCategory
                      onOpenDetail={openDetail}
                      onPreview={openPreview}
                    />
                  ))}
                </div>
              </motion.section>
            ) : view === 'category' ? (
              <motion.section
                key="categories"
                className="f10-camo-section"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="f10-camo-cat-grid">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className="f10-camo-cat"
                      style={{ '--camo-accent': category.accentColor }}
                      onClick={() => selectCategory(category.id)}
                    >
                      <div className="f10-camo-cat__art">
                        <CamoImage
                          src={category.heroImage}
                          alt={`${category.name} rewards`}
                          accentColor={category.accentColor}
                          glyph={category.icon}
                        />
                      </div>
                      <div className="f10-camo-cat__body">
                        <div className="f10-camo-cat__top">
                          <span className="f10-camo-cat__icon" aria-hidden>
                            {category.icon}
                          </span>
                          <div>
                            <div className="f10-camo-cat__name">
                              {category.name.toUpperCase()}
                            </div>
                            <div className="f10-camo-cat__type">
                              {(
                                category.items[0]?.rewardTypePlural || ''
                              ).toUpperCase()}
                            </div>
                          </div>
                          <ChevronRight
                            className="f10-camo-cat__chev"
                            size={16}
                            strokeWidth={2.4}
                            aria-hidden
                          />
                        </div>
                        <div className="f10-camo-cat__progress">
                          {category.unlocked} / {category.total} CAMOS UNLOCKED
                        </div>
                        <div className="f10-camo-card__track">
                          <div
                            className="f10-camo-card__fill"
                            style={{ width: `${category.percent}%` }}
                          />
                        </div>
                        <div className="f10-camo-cat__highest">
                          {category.highestCamo
                            ? `Highest: ${category.highestCamo}`
                            : `Next: ${category.nextItem?.camoName || '—'}`}
                        </div>
                      </div>
                    </button>
                  ))}

                  {nukePreview?.collection ? (
                    <div
                      className="f10-camo-cat f10-camo-cat--nuke-preview"
                      style={{ '--camo-accent': nukePreview.collection.accentColor }}
                    >
                      <div className="f10-camo-cat__art">
                        <div className="f10-camo-img">
                          <div className="f10-camo-img__fallback" aria-hidden>
                            <span className="f10-camo-img__glyph">{nukePreview.collection.icon}</span>
                          </div>
                        </div>
                      </div>
                      <div className="f10-camo-cat__body">
                        <div className="f10-camo-cat__name">
                          {nukePreview.collection.name.toUpperCase()}
                        </div>
                        <div className="f10-camo-cat__type">ADMIN PREVIEW · UNRELEASED</div>
                        <div className="f10-camo-cat__progress">0 / 0 rewards live</div>
                        <div className="f10-camo-cat__highest">{nukePreview.message}</div>
                      </div>
                    </div>
                  ) : null}

                  {upcomingCategories.map((category) => (
                    <div
                      key={category.id}
                      className="f10-camo-cat f10-camo-cat--soon"
                      style={{ '--camo-accent': category.accentColor }}
                    >
                      <div className="f10-camo-cat__art">
                        <div className="f10-camo-img f10-camo-img--dim">
                          <div className="f10-camo-img__fallback" aria-hidden>
                            <span className="f10-camo-img__glyph">{category.icon}</span>
                          </div>
                        </div>
                      </div>
                      <div className="f10-camo-cat__body">
                        <div className="f10-camo-cat__name">{category.name.toUpperCase()}</div>
                        <div className="f10-camo-cat__type">
                          <Lock size={10} strokeWidth={2.6} aria-hidden /> MORE COMING SOON
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <CollectionProgress collections={collections} onSelect={(camoId) => {
                  setView('camo');
                  selectCamo(camoId);
                }} />
              </motion.section>
            ) : (
              <motion.section
                key="camos"
                className="f10-camo-section"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="f10-camo-tier-grid">
                  {camoTiers.map((camo) => (
                    <button
                      key={camo.id}
                      type="button"
                      className={`f10-camo-tier f10-camo-tier--${camo.rarity}`}
                      style={{
                        '--camo-accent': camo.accentColor,
                        '--camo-accent-alt': camo.accentColorAlt,
                      }}
                      onClick={() => selectCamo(camo.id)}
                    >
                      <span className="f10-camo-tier__swatch" aria-hidden />
                      <span className="f10-camo-tier__name">{camo.name.toUpperCase()}</span>
                      <span className="f10-camo-tier__rarity">{camo.rarityLabel}</span>
                      <span className="f10-camo-tier__count">
                        {camo.unlocked} / {camo.total}
                      </span>
                      <span className="f10-camo-card__track">
                        <span
                          className="f10-camo-card__fill"
                          style={{ width: `${camo.percent}%` }}
                        />
                      </span>
                    </button>
                  ))}
                </div>

                <CollectionProgress collections={collections} onSelect={selectCamo} />
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {previewItem ? (
          <CamoPreviewModal
            key={previewItem.id}
            item={previewItem}
            onClose={() => setPreviewItemId(null)}
            onHowToEarn={handleHowToEarn}
          />
        ) : null}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}

/** Cross-category completion rollup, e.g. "WOODLAND COLLECTION 4 / 5 · 80%". */
function CollectionProgress({ collections, onSelect }) {
  return (
    <div className="f10-camo-collections">
      <div className="f10-camo-collections__head">
        <Sparkles size={14} strokeWidth={2.3} aria-hidden />
        <span>COLLECTION PROGRESS</span>
      </div>
      <div className="f10-camo-collections__grid">
        {collections.map((collection) => (
          <button
            key={collection.camo}
            type="button"
            className={`f10-camo-collection ${collection.complete ? 'is-complete' : ''}`}
            style={{
              '--camo-accent': collection.accentColor,
              '--camo-accent-alt': collection.accentColorAlt,
            }}
            onClick={() => onSelect?.(collection.camo)}
          >
            <div className="f10-camo-collection__top">
              <span className="f10-camo-collection__name">
                {collection.collectionName.toUpperCase()}
              </span>
              <span className="f10-camo-collection__pct">{collection.percent}%</span>
            </div>
            <div className="f10-camo-collection__count">
              {collection.unlocked} / {collection.total} STARTER ITEMS
            </div>
            <div className="f10-camo-card__track">
              <div
                className="f10-camo-card__fill"
                style={{ width: `${collection.percent}%` }}
              />
            </div>
            <div className="f10-camo-collection__pieces">
              {collection.items.map((piece) => (
                <span
                  key={piece.id}
                  className={piece.unlocked ? 'is-unlocked' : 'is-locked'}
                  title={`${piece.rewardTypeName} — ${piece.unlocked ? 'unlocked' : 'locked'}`}
                >
                  {piece.rewardTypeName} {piece.unlocked ? '✓' : '🔒'}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
