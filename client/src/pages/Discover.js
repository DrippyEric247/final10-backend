import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ebayService } from '../services/ebayService';
import FeedCard from '../components/FeedCard';

export default function Discover() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef(null);
  // Refs mirror state so loadMore can stay referentially stable (no re-creation
  // on every load), which keeps the mount/observer effects from re-firing.
  const loadingRef = useRef(false);
  const cursorRef = useRef(null);

  const loadMore = useCallback(async (first = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const page = first ? 1 : (cursorRef.current || 1) + 1;
      const data = await ebayService.searchItems({
        page,
        limit: 12,
        sortOrder: 'EndTimeSoonest'
      });
      const next = data.items || [];
      const nextCursor = data.pagination?.hasNextPage ? page : null;
      setItems(prev => first ? next : [...prev, ...next]);
      cursorRef.current = nextCursor;
      setCursor(nextCursor);
    } catch (error) {
      console.error('Error loading more items:', error);
      // Don't update items on error, just stop loading
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMore(true); }, [loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && cursor) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Discover</h1>
      {items.map(it => <FeedCard key={`${it.source}-${it.sourceId || it._id}`} item={it} />)}
      <div ref={sentinelRef} className="py-6 text-center text-neutral-500">
        {loading ? 'Loading…' : cursor ? 'Scroll to load more' : 'No more items'}
      </div>
    </div>
  );
}

