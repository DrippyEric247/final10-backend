import React from "react";
import { SavvyPointsIcon } from "../rewards/SavvyPointsIcon";
import type { SellerBonus } from "../../lib/sellerTrendEngine";
import "../../styles/SellerTrendIntel.css";

export type SellerTrendBadgeProps = {
  bonus: SellerBonus;
  className?: string;
};

/**
 * Compact banner shown next to the seller's Promote / List CTA whenever
 * the target category is actually trending. Stays hidden otherwise so
 * new sellers don't get a false-positive "you're trending" feel.
 */
export default function SellerTrendBadge({ bonus, className = "" }: SellerTrendBadgeProps) {
  if (!bonus?.trending) return null;

  return (
    <div
      className={`seller-trend-badge ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="seller-trend-badge-label">{bonus.label}</div>
      <div className="seller-trend-badge-meta">
        <span className="seller-trend-badge-savvy">
          <SavvyPointsIcon size={14} glow />
          +{bonus.bonusSavvy} Savvy
        </span>
        <span className="seller-trend-badge-sep" aria-hidden>·</span>
        <span>+{bonus.visibilityBoostPct}% feed lift</span>
      </div>
    </div>
  );
}
