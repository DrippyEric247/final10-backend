import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMasterClassifiedCollection } from '../lib/api';
import { withMasterClassifiedImages, getMasterClassifiedHeroAsset } from '../config/masterClassifiedAssets';
import { CAMO_LOCKER_SYNC_EVENT } from '../lib/camoLockerBus';

/**
 * Classified / Master Collection data hook — server is source of truth.
 * @param {boolean} [enabled]
 */
export default function useMasterClassifiedCollection(enabled = true) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!enabled) return null;
    if (!silent) setLoading(true);
    try {
      const data = await getMasterClassifiedCollection();
      if (mounted.current) {
        setPayload(data);
        setError(null);
      }
      return data;
    } catch (err) {
      if (mounted.current) setError(err);
      return null;
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    reload({ silent: false });
    const onSync = () => reload({ silent: true });
    window.addEventListener(CAMO_LOCKER_SYNC_EVENT, onSync);
    return () => window.removeEventListener(CAMO_LOCKER_SYNC_EVENT, onSync);
  }, [enabled, reload]);

  const items = useMemo(
    () => (payload?.items || []).map((item) => withMasterClassifiedImages(item)),
    [payload]
  );

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  return {
    loading,
    error,
    payload,
    collection: payload?.collection || null,
    summary: payload?.summary || null,
    items,
    itemsById,
    revealRewards: Boolean(payload?.revealRewards),
    collectionSerialNumber: payload?.collectionSerialNumber ?? null,
    unlockSnapshot: payload?.unlockSnapshot || null,
    completionData: payload?.completionData || null,
    savvyBonusGranted: Boolean(payload?.savvyBonusGranted),
    bonusEmblemId: payload?.bonusEmblemId || null,
    bonusCallingCardId: payload?.bonusCallingCardId || null,
    heroAsset: getMasterClassifiedHeroAsset(),
    adminPreviewAccess: Boolean(payload?.adminPreviewAccess),
    reload,
  };
}
