import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { withEggKeychainImages } from '../config/eggKeychainAssets';
import { getEggKeychainCollection } from '../lib/api';

/**
 * Egg Keychain Collection data hook — server-authoritative ownership + history.
 * @param {boolean} [enabled]
 */
export default function useEggKeychainCollection(enabled = true) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const data = await getEggKeychainCollection();
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
      return state.items.map((item) => withEggKeychainImages(item));
    }
    return [];
  }, [state]);

  const summary = useMemo(() => state?.summary || { total: 0, owned: 0, locked: 0 }, [state]);

  return {
    loading,
    error,
    state,
    items,
    summary,
    collection: state?.collection || null,
    streamHouseNote: state?.streamHouseNote || '',
    reload: load,
  };
}
