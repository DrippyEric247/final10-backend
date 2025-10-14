import React, { useEffect, useState, useRef } from 'react';
import { ebayService } from '../services/ebayService';
import FeedCard from '../components/FeedCard';

export default function Discover() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef(null);

  async function loadMore(first = false) {
    if (loading) return;
    setLoading(true);
    try {
      const page = first ? 1 : (cursor || 1) + 1;
      const data = await ebayService.searchItems({ 
        page, 
        limit: 12,
        sortOrder: 'EndTimeSoonest'
      });
      const next = data.items || [];
      const nextCursor = data.pagination?.hasNextPage ? page : null;
      setItems(prev => first ? next : [...prev, ...next]);
      setCursor(nextCursor);
    } catch (error) {
      console.error('Error loading more items:', error);
      // Don't update items on error, just stop loading
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadMore(true); }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && cursor) loadMore();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loading]);

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

