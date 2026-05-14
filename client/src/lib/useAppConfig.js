// src/lib/useAppConfig.js
import { useEffect, useState } from 'react';
import { buildApiUrl } from './runtimeApi';

export function useAppConfig() {
  const [cfg, setCfg] = useState(window.__APP_CONFIG__ || null);
  const [loading, setLoading] = useState(!window.__APP_CONFIG__);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (cfg) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetch(buildApiUrl('/config/public'))
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
      .catch((error) => {
        if (!active) return;
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch app config:', error);
        }
        setError(error);
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

