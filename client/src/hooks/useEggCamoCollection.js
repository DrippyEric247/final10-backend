import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildEggCamoRows, summarizeEggCamoCollection, getClosestEggCamo } from '@savvy/core/config/eggCamoCollection';
import { withEggCamoImages } from '../config/eggCamoAssets';
import { acknowledgeEggCamoCelebrations, getEggCamoCollection } from '../lib/api';

/**
 * Egg Camo Collection data hook — server-authoritative lifetime mastery.
 * @param {boolean} [enabled]
 */
export default function useEggCamoCollection(enabled = true) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const data = await getEggCamoCollection();
      setState(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, load]);

  const items = useMemo(() => {
    if (state?.items?.length) {
      return state.items.map((item) => withEggCamoImages(item));
    }
    return buildEggCamoRows().map((item) => withEggCamoImages(item));
  }, [state]);

  const summary = useMemo(() => {
    if (state?.summary) return state.summary;
    return summarizeEggCamoCollection(items);
  }, [state, items]);

  const closestCamo = useMemo(() => {
    if (state?.closestCamo) return state.closestCamo;
    const closest = getClosestEggCamo(items);
    if (!closest) return null;
    return {
      id: closest.id,
      name: closest.name,
      remaining: Math.max(0, closest.target - closest.current),
      eggRarityLabel: closest.eggRarityLabel,
    };
  }, [state, items]);

  const pendingUnlockCelebrations = useMemo(
    () => state?.pendingUnlockCelebrations || [],
    [state]
  );

  const ackCelebrations = useCallback(async (camoIds) => {
    const data = await acknowledgeEggCamoCelebrations(camoIds);
    setState(data);
    return data;
  }, []);

  const itemsByRarity = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (!map.has(item.eggTier)) map.set(item.eggTier, []);
      map.get(item.eggTier).push(item);
    }
    return map;
  }, [items]);

  return {
    loading,
    error,
    items,
    itemsByRarity,
    summary,
    closestCamo,
    collectionMastered: Boolean(state?.collectionMastered),
    collectionMasteredAt: state?.collectionMasteredAt || null,
    lifetimeCollected: state?.lifetimeCollected || {},
    pendingUnlockCelebrations,
    reload: load,
    ackCelebrations,
  };
}
