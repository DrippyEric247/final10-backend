// src/lib/useAppConfig.js
import { useEffect, useState } from 'react';

export function useAppConfig() {
  const [cfg, setCfg] = useState(window.__APP_CONFIG__ || null);

  useEffect(() => {
    if (cfg) return; // already injected
    fetch('http://localhost:5000/api/config/public')
      .then(async (r) => {
        if (!r.ok) {
          if (r.status === 429) {
            console.warn('Rate limited on config fetch, will retry later');
            return null;
          }
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.json();
      })
      .then(setCfg)
      .catch((error) => {
        console.error('Failed to fetch app config:', error);
        setCfg(null);
      });
  }, [cfg]);

  return cfg;
}

