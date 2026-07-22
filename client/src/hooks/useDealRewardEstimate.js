import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { estimateDealRewards } from '../lib/api';

const cache = new Map();
const inflight = new Map();

function cacheKey(listingId, trustScore, price, savings) {
  return `${listingId}:${Math.round(Number(trustScore) || 0)}:${price}:${savings}`;
}

/**
 * Fetch server-authoritative deal reward estimate with in-memory cache.
 */
export function useDealRewardEstimate(listingSnapshot) {
  const { user } = useAuth() || {};
  const listingId = String(listingSnapshot?.listingId || '').trim();
  const trustScore = Number(listingSnapshot?.trustScore) || 0;
  const price = listingSnapshot?.price ?? '';
  const savings = listingSnapshot?.savings ?? '';
  const estimatedPointsEarned = listingSnapshot?.estimatedPointsEarned ?? '';
  const key = listingId ? cacheKey(listingId, trustScore, price, savings) : '';
  const [estimate, setEstimate] = useState(() => (key ? cache.get(key) || null : null));
  const [loading, setLoading] = useState(Boolean(listingId && !cache.has(key)));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!listingId) return null;
    const payload = { ...listingSnapshot, listingId };
    const result = await estimateDealRewards([payload]);
    const next = result?.estimates?.[listingId] || null;
    if (next) cache.set(key, next);
    if (mountedRef.current) setEstimate(next);
    return next;
  }, [listingId, listingSnapshot, key]);

  useEffect(() => {
    if (!listingId) {
      setEstimate(null);
      setLoading(false);
      return undefined;
    }

    if (cache.has(key)) {
      setEstimate(cache.get(key));
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      if (inflight.has(key)) {
        await inflight.get(key);
        if (!cancelled && mountedRef.current) {
          setEstimate(cache.get(key) || null);
          setLoading(false);
        }
        return;
      }

      const payload = {
        listingId,
        trustScore,
        price,
        savings,
        estimatedPointsEarned,
      };

      const promise = estimateDealRewards([payload])
        .then((result) => {
          const next = result?.estimates?.[listingId] || null;
          if (next) cache.set(key, next);
          return next;
        })
        .finally(() => {
          inflight.delete(key);
        });

      inflight.set(key, promise);
      const next = await promise;
      if (!cancelled && mountedRef.current) {
        setEstimate(next);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, listingId, trustScore, price, savings, estimatedPointsEarned, key]);

  return { estimate, loading, refresh };
}

export function invalidateDealRewardEstimate(listingId) {
  if (!listingId) return;
  const prefix = `${String(listingId)}:`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}
