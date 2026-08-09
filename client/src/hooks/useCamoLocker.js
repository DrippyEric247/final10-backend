import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CAMO_ITEMS,
  CAMOS,
  ACTIVE_CAMO_CATEGORIES,
  CAMO_CATEGORIES,
  getCamoRarity,
  getOperatorRank,
  summarizeCamoProgress,
  summarizeCamoCollections,
  filterVisibleCamoItems,
  filterVisibleCamos,
  toPercent,
} from '@savvy/core/config/camoLocker';
import { withCamoImages, resolveCategoryHeroImage } from '../config/camoAssets';
import { getCamoLocker, markCamosSeen as markCamosSeenRemote } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CAMO_LOCKER_SYNC_EVENT } from '../lib/camoLockerBus';

const isDev = process.env.NODE_ENV === 'development';

function devLog(...args) {
  if (isDev) console.info('[CamoLocker]', ...args);
}

/** Catalog-only rows used for guests and while the first fetch is in flight. */
function buildLockedFallback(hasPrivateAccess) {
  return filterVisibleCamoItems(CAMO_ITEMS, hasPrivateAccess).map((item) => ({
    ...withCamoImages(item),
    unlocked: false,
    progress: 0,
    current: 0,
    target: item.threshold,
    gateStatus: item.gates.map((g) => ({ label: g.label, met: false, current: 0, min: g.min })),
    gatesMet: false,
    unlockedAt: null,
    serialNumber: null,
    claimedAt: null,
    isNew: false,
  }));
}

function mergeServerState(state, hasPrivateAccess) {
  const catalog = filterVisibleCamoItems(CAMO_ITEMS, hasPrivateAccess);
  if (!state?.items?.length) return buildLockedFallback(hasPrivateAccess);
  const byId = new Map(state.items.map((row) => [row.id, row]));
  const newIds = new Set(state.newCamoIds || []);
  return catalog.map((item) => {
    const row = byId.get(item.id);
    return {
      ...withCamoImages(item),
      unlocked: Boolean(row?.unlocked),
      progress: Number(row?.progress) || 0,
      current: Number(row?.current) || 0,
      target: Number(row?.target) || item.threshold,
      gateStatus: row?.gateStatus || [],
      gatesMet: Boolean(row?.gatesMet),
      unlockedAt: row?.unlockedAt || null,
      serialNumber: row?.serialNumber ?? null,
      claimedAt: row?.claimedAt || null,
      capturedProfileLevel: row?.capturedProfileLevel ?? null,
      capturedPrestige: row?.capturedPrestige ?? null,
      capturedEmblemId: row?.capturedEmblemId || null,
      capturedCallingCardId: row?.capturedCallingCardId || null,
      capturedUserId: row?.capturedUserId || null,
      capturedUsername: row?.capturedUsername || null,
      isNew: newIds.has(item.id),
    };
  });
}

/**
 * Universal Camo Locker data hook.
 *
 * Server state is the source of truth; the catalog only supplies presentation.
 * Guests get a fully-locked read-only locker so they can still see the goal.
 *
 * @param {boolean} [enabled] skip fetching while the locker is closed
 */
export default function useCamoLocker(enabled = true) {
  const { user, token } = useAuth() || {};
  const authed = Boolean(token && user);
  const [serverState, setServerState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!authed) {
        setServerState(null);
        return null;
      }
      if (inFlight.current) return null;
      inFlight.current = true;
      if (!silent) setLoading(true);
      try {
        const data = await getCamoLocker();
        setServerState(data);
        setError(null);
        devLog('loaded user collection', {
          unlocked: data?.unlockedCamoIds?.length || 0,
          total: filterVisibleCamoItems(
            CAMO_ITEMS,
            Boolean(data?.privateRewardsAccess ?? data?.nukePreviewAccess)
          ).length,
        });
        return data;
      } catch (err) {
        setError(err);
        devLog('load failed', err?.message || err);
        return null;
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [authed]
  );

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onSync = (e) => {
      devLog('sync requested', e?.detail?.reason || 'unknown');
      load({ silent: true });
    };
    window.addEventListener(CAMO_LOCKER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(CAMO_LOCKER_SYNC_EVENT, onSync);
  }, [enabled, load]);

  const hasPrivateAccess = Boolean(
    serverState?.privateRewardsAccess ?? serverState?.nukePreviewAccess
  );

  const items = useMemo(
    () => mergeServerState(serverState, hasPrivateAccess),
    [serverState, hasPrivateAccess]
  );

  const unlockedIds = useMemo(
    () => new Set(items.filter((i) => i.unlocked).map((i) => i.id)),
    [items]
  );

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const summary = useMemo(() => {
    const base = summarizeCamoProgress(items, unlockedIds);
    const profileLevel = Number(serverState?.profileLevel) || 1;
    const rank = getOperatorRank(profileLevel);
    return {
      ...base,
      savvyPoints: Number(serverState?.savvyPoints ?? user?.savvyPoints) || 0,
      profileLevel,
      rankLabel: rank.label,
      rankColor: rank.color,
      currentStreak: Number(serverState?.currentStreak) || 0,
      battlePassTier: Number(serverState?.battlePassTier) || 0,
    };
  }, [items, unlockedIds, serverState, user]);

  /** Category cards with progress, hero art and highest camo earned. */
  const categories = useMemo(() => {
    const counters = serverState?.categoryProgress || {};
    return ACTIVE_CAMO_CATEGORIES.map((category) => {
      const catItems = items.filter((i) => i.category === category.id);
      const rollup = summarizeCamoProgress(catItems, unlockedIds);
      const nextLocked = catItems.find((i) => !i.unlocked) || null;
      return {
        ...category,
        ...rollup,
        heroImage: resolveCategoryHeroImage(category.id),
        activityCount: Math.max(0, Number(counters[category.id]) || 0),
        nextItem: nextLocked,
        items: catItems,
      };
    });
  }, [items, unlockedIds, serverState]);

  /** Placeholder cards for categories that aren't live yet. */
  const upcomingCategories = useMemo(
    () => CAMO_CATEGORIES.filter((c) => c.comingSoon && c.visibility !== 'secret'),
    []
  );

  /** Per-camo cross-category collections ("Woodland Collection 4 / 5"). */
  const collections = useMemo(() => {
    const visibleCamoIds = new Set(filterVisibleCamos(CAMOS, CAMO_ITEMS, hasPrivateAccess).map((c) => c.id));
    const rollups = summarizeCamoCollections(unlockedIds).filter((rollup) =>
      visibleCamoIds.has(rollup.camo)
    );
    return rollups.map((rollup) => ({
      ...rollup,
      rarityLabel: getCamoRarity(rollup.rarity).label,
      items: items.filter((i) => i.camo === rollup.camo),
    }));
  }, [items, unlockedIds, hasPrivateAccess]);

  const camoTiers = useMemo(
    () =>
      filterVisibleCamos(CAMOS, CAMO_ITEMS, hasPrivateAccess).map((camo) => {
        const camoItems = items.filter((i) => i.camo === camo.id);
        const unlocked = camoItems.filter((i) => i.unlocked).length;
        return {
          ...camo,
          rarityLabel: getCamoRarity(camo.rarity).label,
          unlocked,
          total: camoItems.length,
          percent: toPercent(unlocked, camoItems.length),
        };
      }),
    [items, hasPrivateAccess]
  );

  /**
   * Closest-to-unlock item — powers the Savvy Scout hint. Only considers items
   * whose secondary gates are already satisfied so the advice is actionable.
   */
  const nearestUnlock = useMemo(() => {
    const candidates = items.filter((i) => !i.unlocked && i.target > 0);
    if (!candidates.length) return null;
    const actionable = candidates.filter((i) => i.gatesMet);
    const pool = actionable.length ? actionable : candidates;
    return pool.reduce((best, item) => {
      const remaining = item.target - item.current;
      const bestRemaining = best ? best.target - best.current : Infinity;
      if (remaining < bestRemaining) return item;
      if (remaining === bestRemaining && item.progress > (best?.progress || 0)) return item;
      return best;
    }, null);
  }, [items]);

  const markSeen = useCallback(
    async (ids) => {
      const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
      if (!authed || !list.length) return;
      try {
        const data = await markCamosSeenRemote(list);
        if (data?.items) setServerState(data);
      } catch {
        /* NEW ribbons are cosmetic — never surface a failure here */
      }
    },
    [authed]
  );

  return {
    authed,
    loading,
    error,
    items,
    itemsById,
    unlockedIds,
    summary,
    categories,
    upcomingCategories,
    collections,
    camoTiers,
    nearestUnlock,
    categoryProgress: serverState?.categoryProgress || {},
    reload: load,
    markSeen,
    nukePreviewAccess: hasPrivateAccess,
    privateRewardsAccess: hasPrivateAccess,
  };
}
