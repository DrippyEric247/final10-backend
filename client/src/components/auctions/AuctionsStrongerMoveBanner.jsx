import React from "react";
import "../../styles/AuctionsSavvyCompareModal.css";

export default function AuctionsStrongerMoveBanner({ visible, onView, onDismiss }) {
  if (!visible) return null;

  return (
    <div
      className="auctions-stronger-banner"
      role="region"
      aria-label="Savvy stronger move recommendation"
    >
      <span className="auctions-stronger-banner__icon" aria-hidden>
        ✨
      </span>
      <div className="auctions-stronger-banner__copy">
        <p className="auctions-stronger-banner__title">Savvy found a stronger move</p>
        <p className="auctions-stronger-banner__sub">
          Keep browsing — open when you&apos;re ready. Your place in the list stays put.
        </p>
      </div>
      <div className="auctions-stronger-banner__actions">
        <button
          type="button"
          className="auctions-stronger-banner__btn auctions-stronger-banner__btn--primary"
          onClick={onView}
        >
          View Stronger Deal
        </button>
        <button
          type="button"
          className="auctions-stronger-banner__btn auctions-stronger-banner__btn--ghost"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
