import React, { useMemo } from "react";
import { SavvyPointsIcon } from "./SavvyPointsIcon";
import { DUAL_EARN_TAGLINE, computeDualEarn } from "../../lib/dualEarn";

/**
 * DualEarnChip
 *
 * A compact, two-sided Savvy indicator that makes it obvious Final10 pays
 * BOTH the buyer and the seller for a listing. Drops under the primary
 * SavvyRewardBadge on every deal card.
 *
 *  ┌────────────────────────────────────────────────────────┐
 *  │  You earn +120 Savvy   •   Seller earns +80 when sold   │
 *  │  Every move earns. Smart moves earn more.               │
 *  └────────────────────────────────────────────────────────┘
 *
 * Rationale: sellers need to feel the incentive too; buyers need to know
 * their activity is part of a broader economy (not just a discount). One
 * glance should communicate both sides without crowding the card.
 */

/**
 * @param {{
 *   price?: number|string,
 *   marketValue?: number|string,
 *   savings?: number|string,
 *   trustScore?: number,
 *   buyerBase?: number,       // precomputed override (matches SavvyRewardBadge)
 *   sellerBase?: number,      // precomputed override
 *   hideTagline?: boolean,
 *   className?: string,
 * }} props
 */
export default function DualEarnChip({
  price,
  marketValue,
  savings,
  trustScore,
  buyerBase,
  sellerBase,
  hideTagline = false,
  className = "",
}) {
  const estimate = useMemo(
    () =>
      computeDualEarn({
        price,
        marketValue,
        savings,
        trustScore,
        buyerBase,
        sellerBase,
      }),
    [price, marketValue, savings, trustScore, buyerBase, sellerBase]
  );

  const buyerLocked = estimate.buyer <= 0;

  return (
    <div
      className={`dual-earn-chip ${className}`}
      role="group"
      aria-label="How Savvy earnings split between buyer and seller"
    >
      <div className="dual-earn-chip-row">
        <span
          className={`dual-earn-chip-pill dual-earn-chip-pill--buyer ${
            buyerLocked ? "is-locked" : ""
          }`}
          title={
            buyerLocked
              ? "Rewards are locked for low-trust listings."
              : `You'd earn ~${estimate.buyer.toLocaleString()} Savvy on a smart buy.`
          }
        >
          {buyerLocked ? (
            <span className="dual-earn-chip-lock" aria-hidden>🔒</span>
          ) : (
            <SavvyPointsIcon size={12} />
          )}
          <span className="dual-earn-chip-label">You earn</span>
          <strong className="dual-earn-chip-value">
            {buyerLocked ? "—" : `+${estimate.buyer.toLocaleString()} Savvy`}
          </strong>
        </span>

        <span className="dual-earn-chip-divider" aria-hidden>·</span>

        <span
          className="dual-earn-chip-pill dual-earn-chip-pill--seller"
          title={`Seller earns ~${estimate.seller.toLocaleString()} Savvy when sold.`}
        >
          <span className="dual-earn-chip-tag" aria-hidden>🏷️</span>
          <span className="dual-earn-chip-label">Seller earns</span>
          <strong className="dual-earn-chip-value">
            +{estimate.seller.toLocaleString()} Savvy
          </strong>
          <span className="dual-earn-chip-when">when sold</span>
        </span>
      </div>

      {hideTagline ? null : (
        <div className="dual-earn-chip-tagline">{DUAL_EARN_TAGLINE}</div>
      )}
    </div>
  );
}
