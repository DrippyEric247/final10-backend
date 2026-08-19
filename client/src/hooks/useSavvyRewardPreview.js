import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateSavvyRewardPreview } from '../lib/api';

const cache = new Map();
const inflight = new Map();

function cacheKey(baseAmount, source) {
  return `${source}:${Math.round(Number(baseAmount) || 0)}`;
}

function normalizePreviewOptions(options) {
  if (options == null || typeof options !== 'object') return {};
  return options;
}

function logPreviewGap({ listingId, reason, fields = {} }) {
  if (process.env.NODE_ENV !== 'development') return;
  console.warn('[useSavvyRewardPreview] Reward preview unavailable', {
    listingId: listingId || null,
    reason,
    ...fields,
  });
}

/**
 * Server-authoritative Savvy reward preview for a base amount + source.
 * Used when deal-estimate API is not available (offers, static badges).
 * Accepts null/undefined when preview is disabled (e.g. deal-estimate path).
 */
export function useSavvyRewardPreview(options) {
  const { baseAmount, source, listingId } = normalizePreviewOptions(options);
  const { user } = useAuth() || {};
  const base = Math.round(Number(baseAmount) || 0);
  const src = String(source || 'unknown').trim();
  const enabled = base > 0 && src !== 'unknown';
  const key = enabled ? cacheKey(base, src) : '';

  const [preview, setPreview] = useState(() => (key ? cache.get(key) || null : null));
  const [loading, setLoading] = useState(Boolean(enabled && key && !cache.has(key)));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    const next = await calculateSavvyRewardPreview({ baseAmount: base, source: src });
    if (next) {
      cache.set(key, next);
    } else {
      logPreviewGap({
        listingId,
        reason: 'calculateSavvyRewardPreview_returned_null',
        fields: { baseAmount: base, source: src },
      });
    }
    if (mountedRef.current) setPreview(next);
    return next;
  }, [enabled, base, src, key, listingId]);

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      setLoading(false);
      return undefined;
    }

    if (cache.has(key)) {
      setPreview(cache.get(key));
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      if (inflight.has(key)) {
        await inflight.get(key);
        if (!cancelled && mountedRef.current) {
          setPreview(cache.get(key) || null);
          setLoading(false);
        }
        return;
      }

      const promise = calculateSavvyRewardPreview({ baseAmount: base, source: src })
        .then((next) => {
          if (next) {
            cache.set(key, next);
          } else {
            logPreviewGap({
              listingId,
              reason: 'calculateSavvyRewardPreview_returned_null',
              fields: { baseAmount: base, source: src },
            });
          }
          return next;
        })
        .finally(() => {
          inflight.delete(key);
        });

      inflight.set(key, promise);
      const next = await promise;
      if (!cancelled && mountedRef.current) {
        setPreview(next);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, enabled, base, src, key, listingId]);

  return { preview, loading, refresh };
}

export function invalidateSavvyRewardPreview(baseAmount, source) {
  cache.delete(cacheKey(baseAmount, source));
}
