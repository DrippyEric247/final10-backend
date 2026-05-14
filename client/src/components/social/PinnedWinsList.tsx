import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import "../../styles/SocialControls.css";

type PinnedWin = {
  _id: string;
  title?: string;
  imageUrl?: string;
  currentBid?: number;
  soldPrice?: number;
  endTime?: string;
  status?: string;
};

type PinnedWinsListProps = {
  /** User id whose pinned wins to display. */
  userId: string;
  /** Empty-state message override. */
  emptyMessage?: string;
};

/**
 * Renders the wins a user has chosen to showcase on their profile.
 * Read-only; pin management lives elsewhere.
 */
export default function PinnedWinsList({ userId, emptyMessage }: PinnedWinsListProps) {
  const [items, setItems] = useState<PinnedWin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/users/${userId}/pinned-wins`)
      .then(({ data }) => {
        if (!cancelled) setItems(Array.isArray(data?.pinnedWins) ? data.pinnedWins : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return <div className="pinned-wins pinned-wins--loading">Loading wins…</div>;
  }

  if (!items.length) {
    return (
      <div className="pinned-wins pinned-wins--empty">
        {emptyMessage || "No showcased wins yet."}
      </div>
    );
  }

  return (
    <div className="pinned-wins">
      <div className="pinned-wins-grid">
        {items.map((win) => (
          <article key={win._id} className="pinned-wins-card">
            {win.imageUrl ? (
              <img
                src={win.imageUrl}
                alt={win.title || "Win"}
                className="pinned-wins-img"
                loading="lazy"
              />
            ) : (
              <div className="pinned-wins-img pinned-wins-img--placeholder">🏆</div>
            )}
            <div className="pinned-wins-meta">
              <div className="pinned-wins-title">{win.title || "Untitled win"}</div>
              <div className="pinned-wins-price">
                {typeof win.soldPrice === "number"
                  ? `$${win.soldPrice.toLocaleString()}`
                  : typeof win.currentBid === "number"
                    ? `$${win.currentBid.toLocaleString()}`
                    : "—"}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
