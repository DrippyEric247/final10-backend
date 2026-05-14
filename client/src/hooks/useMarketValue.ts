/**
 * useMarketValue — React hook around the True Market Value API.
 *
 * Usage:
 *   const { stats, loading, error, refresh } = useMarketValue({ q: 'PS5 slim' });
 *
 * The hook:
 *   - Debounces requests so typing into a search field doesn't spam eBay,
 *   - De-duplicates concurrent calls for the same query (across cards),
 *   - Caches the last result for 10 minutes in-memory so navigating back
 *     to a tab doesn't re-fetch unnecessarily,
 *   - Exposes `refresh()` for manual revalidation.
 *
 * The server already caches at the engine level — this client cache is
 * just a UX shim so the same render burst hits the API once.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { MarketStats } from '../lib/marketValue';

const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map<string, { value: MarketStats; ts: number }>();
const inflight = new Map<string, Promise<MarketStats | null>>();

export type UseMarketValueOptions = {
  q?: string;
  conditionIds?: string;
  categoryId?: string;
  source?: 'auto' | 'sold' | 'active';
  enabled?: boolean;
  /** Debounce window for the query, ms. Default 250. */
  debounceMs?: number;
};

export type UseMarketValueResult = {
  stats: MarketStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function buildKey(opts: UseMarketValueOptions): string {
  return [
    String(opts.q || '').trim().toLowerCase(),
    String(opts.conditionIds || ''),
    String(opts.categoryId || ''),
    String(opts.source || 'auto'),
  ].join('|');
}

async function loadMarketValue(
  key: string,
  opts: UseMarketValueOptions
): Promise<MarketStats | null> {
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.ts < CLIENT_CACHE_TTL_MS) {
    return cached.value;
  }
  if (inflight.has(key)) return inflight.get(key) as Promise<MarketStats | null>;

  const promise = (async () => {
    try {
      const { data } = await api.get('/market-value', {
        params: {
          q: opts.q,
          conditionIds: opts.conditionIds,
          categoryId: opts.categoryId,
          source: opts.source,
        },
      });
      const stats: MarketStats | null = data?.data || null;
      if (stats) memoryCache.set(key, { value: stats, ts: Date.now() });
      return stats;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

export function useMarketValue(opts: UseMarketValueOptions): UseMarketValueResult {
  const { q = '', enabled = true, debounceMs = 250 } = opts;
  const [stats, setStats] = useState<MarketStats | null>(() => {
    const k = buildKey(opts);
    return memoryCache.get(k)?.value || null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKeyRef = useRef<string>('');

  const fetchNow = useCallback(
    async (force = false) => {
      if (!enabled || !q.trim()) return;
      const key = buildKey(opts);
      lastKeyRef.current = key;
      if (force) memoryCache.delete(key);
      setLoading(true);
      setError(null);
      try {
        const next = await loadMarketValue(key, opts);
        if (lastKeyRef.current === key) setStats(next);
      } catch (err: any) {
        if (lastKeyRef.current === key) {
          setError(err?.response?.data?.error || err?.message || 'market_value_failed');
        }
      } finally {
        if (lastKeyRef.current === key) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, q, opts.conditionIds, opts.categoryId, opts.source]
  );

  useEffect(() => {
    if (!enabled || !q.trim()) {
      setStats(null);
      return undefined;
    }
    const cached = memoryCache.get(buildKey(opts));
    if (cached) setStats(cached.value);
    const id = window.setTimeout(() => {
      fetchNow(false);
    }, debounceMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, q, opts.conditionIds, opts.categoryId, opts.source, debounceMs]);

  return {
    stats,
    loading,
    error,
    refresh: () => fetchNow(true),
  };
}
