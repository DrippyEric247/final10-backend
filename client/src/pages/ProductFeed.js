import React, { useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import ebayService from "../services/ebayService";
import { useAuth } from "../context/AuthContext";
import "../styles/ProductFeed.css";

async function fetchFeed({ pageParam }) {
  const page = pageParam || 1;
  try {
    const data = await ebayService.searchItems({ 
      page, 
      limit: 20,
      sortOrder: 'EndTimeSoonest'
    });
    // expected shape: { items: [...], nextCursor: "..." | null }
    return {
      items: data.items || [],
      nextCursor: data.pagination?.hasNextPage ? page + 1 : null
    };
  } catch (error) {
    console.error('Error fetching product feed:', error);
    // Return empty data on error to prevent crashes
    return {
      items: [],
      nextCursor: null
    };
  }
}

export default function ProductFeed() {
  const { user } = useAuth();
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery({
    queryKey: ["productFeed"],
    queryFn: fetchFeed,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
    enabled: !!user, // Only run query if user is logged in
  });

  const sentinelRef = useRef(null);

  const onIntersect = useCallback(
    (entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(onIntersect, { rootMargin: "300px" });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [onIntersect]);

  if (!user) {
    return (
      <div className="feed-wrap">
        <header className="feed-header">
          <h1>Product Feed</h1>
          <p className="muted">Swipe/scroll through hot auctions across platforms.</p>
        </header>
        <div className="feed-status">
          <p>Please <Link to="/login">login</Link> to view the product feed</p>
        </div>
      </div>
    );
  }

  if (status === "loading") return <div className="feed-status">Loading…</div>;
  if (status === "error") return <div className="feed-status">Error: {String(error)}</div>;

  const items = data?.pages.flatMap((p) => p.items) || [];

  return (
    <div className="feed-wrap">
      <header className="feed-header">
        <h1>Product Feed</h1>
        <p className="muted">Swipe/scroll through hot auctions across platforms.</p>
      </header>

      <div className="feed-grid">
        {items.map((it) => (
          <article key={it.id} className="card">
            <div className="thumb">
              {/* fallback image safe-guard */}
              <img src={it.image || "/placeholder.png"} alt={it.title} loading="lazy" />
              <span className="chip">eBay</span>
              {typeof it.aiScore === "number" && (
                <span className="chip chip-score">AI {Math.round(it.aiScore)}%</span>
              )}
            </div>

            <div className="meta">
              <h3 className="title" title={it.title}>{it.title}</h3>
              <div className="row">
                <span className="price">${it.currentPrice?.toLocaleString?.() ?? it.price}</span>
                <span className="end">Ends {it.endsIn || it.endsAtHuman}</span>
              </div>
              <div className="row">
                <span className="sub">Bids: {it.bids ?? 0}</span>
                <span className="sub">Competition: {it.competition ?? "—"}</span>
              </div>
            </div>

            <div className="actions">
              {it.auctionId ? (
                <Link className="btn btn-primary" to={`/auctions/${it.auctionId}`}>Open Auction</Link>
              ) : it.url ? (
                <a className="btn btn-primary" href={it.url} target="_blank" rel="noreferrer">Open</a>
              ) : null}
              <button
                className="btn btn-ghost"
                onClick={() => navigator.share?.({ title: it.title, url: it.url || window.location.href })
                  .catch(() => {})}
              >
                Share
              </button>
            </div>
          </article>
        ))}

        {/* sentinel for infinite scroll */}
        <div ref={sentinelRef} />
      </div>

      {isFetchingNextPage && <div className="feed-status">Loading more…</div>}
      {!hasNextPage && <div className="feed-status muted">You’re all caught up.</div>}
    </div>
  );
}

