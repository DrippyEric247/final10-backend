import { useEffect } from 'react';
import { beginScoutScan, endScoutScan } from '../lib/scoutScanActivity';

/** Register a page/feature as actively scanning while `active` is true. */
export function useScoutScanRegistration(sourceId, active) {
  useEffect(() => {
    const id = String(sourceId || '').trim();
    if (!id) return undefined;
    if (active) beginScoutScan(id);
    else endScoutScan(id);
    return () => endScoutScan(id);
  }, [sourceId, active]);
}
