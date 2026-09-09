import { useCallback, useEffect, useRef, useState } from 'react';
import { getSavvyWatchLivePromo } from '../lib/api';

const PROMO_POLL_MS = 60_000;

export function useSavvyWatchLivePromo() {
  const [promo, setPromo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await getSavvyWatchLivePromo();
      if (!mountedRef.current) return;
      setPromo(data);
      setError('');
    } catch (e) {
      if (!mountedRef.current) return;
      setPromo({ live: false });
      setError(e?.response?.data?.message || e.message || 'Failed to load live promo.');
    } finally {
      if (mountedRef.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      refresh({ silent: true });
    };

    const intervalId = window.setInterval(poll, PROMO_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { promo, loading, error, refresh };
}
