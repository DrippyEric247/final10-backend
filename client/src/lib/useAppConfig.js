// src/lib/useAppConfig.js
import { useEffect, useState } from 'react';
import { buildApiUrl } from './runtimeApi';

export function useAppConfig() {
  const [cfg, setCfg] = useState(() =>
    typeof window !== "undefined" ? window.__APP_CONFIG__ || null : null
  );
  const [loading, setLoading] = useState(() =>
    typeof window !== "undefined" ? !window.__APP_CONFIG__ : true
  );
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (cfg) {
      setLoading(false);
      return;
    }

    const configUrl = buildApiUrl('/config/public');
    if (!configUrl) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);
    fetch(configUrl)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.json();
      })
      .then((next) => {
        if (!active) return;
        setCfg(next);
      })
      .catch((fetchError) => {
        if (!active) return;
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch app config:', fetchError);
        }
        setError(fetchError);
        setCfg(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cfg, reloadTick]);

  return {
    cfg,
    loading,
    error,
    reload: () => setReloadTick((n) => n + 1),
  };
}
