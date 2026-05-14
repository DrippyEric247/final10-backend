import React from "react";
import ListingCardImage from "./ListingCardImage";
import SavvyAlertButton from "../alerts/SavvyAlertButton";
import SavvyTrustPanel from "../trust/SavvyTrustPanel";
import "../../styles/EliteAuctionCard.css";

/** @deprecated Prefer `pickEliteAiFeelingBadge` (emoji + single “AI feeling” line). */
export function elitePlayBadgeFromTier(tier) {
  if (tier === "high") return "🔥 Strong Pick";
  if (tier === "medium") return "🧠 Calculated Play";
  return "🧠 Calculated Play";
}

function savingsPctFrom({ marketValueNum, displayPriceNum }) {
  const mv = Number(marketValueNum);
  const dp = Number(displayPriceNum);
  if (!Number.isFinite(mv) || mv <= 0 || !Number.isFinite(dp)) return 0;
  return Math.max(0, ((mv - dp) / mv) * 100);
}

/**
 * Exactly one “AI feeling” badge — priority: low competition → high value → strong tier → default.
 */
export function pickEliteAiFeelingBadge({
  tier,
  dealScore,
  savingsAmount,
  savingsPct,
  bidCount,
  isAuction,
}) {
  const bids = Number(bidCount) || 0;
  const pct = Number(savingsPct) || 0;
  const score = Number(dealScore) || 0;
  const sav = Number(savingsAmount) || 0;

  if (isAuction && bids <= 2) return "⚡ Low Competition";
  if (pct >= 20 || score >= 73 || sav >= 500) return "💎 High Value";
  if (tier === "high") return "🔥 Strong Pick";
  return "🧠 Calculated Play";
}

/**
 * ELITE CARD v1 — image hook (deal / savings / urgency) + info + action hierarchy.
 */
export default function EliteAuctionCard({
  className = "",
  item,
  title,
  dealScore,
  /** Top-right chip, e.g. "SAVE $1,319" */
  savingsChipText,
  priceDisplay,
  /** Next to price, e.g. "Save $1,319" */
  savingsSubline,
  trustScore,
  /** Full Savvy Trust Engine assessment when available (badge + AI confidence). */
  trustResult = null,
  /** Best-move tier from listing engine (`high` | `medium` | `low`). */
  tier = "medium",
  bidCount = 0,
  isAuction = false,
  savingsAmount = 0,
  displayPriceNum,
  marketValueNum,
  urgencyLabel,
  cardState = "normal",
  isNew = false,
  showSavvyUnlocked = false,
  /** Free tier: subtle Quick Snipes paywall hook (shown when true + handler set). */
  showQuickSnipesPremiumHook = false,
  onQuickSnipesPremiumClick,
  isSaved = false,
  poppedSaved = false,
  onSave,
  onBidNow,
  showBidButton = false,
  alertPayload,
  /** Outcome-first CTA (opens Savvy alert flow). */
  alertLabel = "⚡ Let Savvy Find Better",
  ebayHref,
  onOpenEbay,
  saveDataFtue,
  childrenFooter,
}) {
  const rootClass = [
    "elite-card",
    className,
    isNew ? "elite-card--new" : "",
    cardState === "critical" ? "elite-card--critical" : "",
    cardState === "urgent" ? "elite-card--urgent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const savingsTop = showSavvyUnlocked ? 52 : 12;
  const trustRounded = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        Number(trustResult?.sellerTrustScore ?? trustResult?.trustScore ?? trustScore) || 0
      )
    )
  );
  const trustSegments = Math.min(10, Math.max(0, Math.round(trustRounded / 10)));
  const savingsPct = savingsPctFrom({ marketValueNum, displayPriceNum });
  const aiFeelingBadge = pickEliteAiFeelingBadge({
    tier,
    dealScore,
    savingsAmount,
    savingsPct,
    bidCount,
    isAuction,
  });

  return (
    <div className={rootClass}>
      <div className="elite-card__media">
        <ListingCardImage item={item} alt={title || "Listing"} aspectRatio="1 / 1" borderRadius="14px" />
        <div className="elite-card__overlay" aria-hidden />
        <div className="elite-card__chip elite-card__chip--score" aria-label={`Deal score ${dealScore}`}>
          <span aria-hidden>⭐</span>
          <span>{dealScore}</span>
        </div>
        {showSavvyUnlocked ? (
          <div className="elite-card__savvy-unlock">Savvy Best Move Unlocked</div>
        ) : null}
        <div
          className="elite-card__chip--savings-wrap"
          style={{ top: savingsTop }}
          aria-label={savingsChipText}
        >
          <span className="elite-card__chip--savings-text">💰 {savingsChipText}</span>
        </div>
        <div className="elite-card__chip elite-card__chip--urgency">
          <span aria-hidden>⏳</span>
          <span>{urgencyLabel}</span>
        </div>
      </div>

      <div className="elite-card__body">
        <h3 className="elite-card__title">{title}</h3>

        <div className="elite-card__price-row" aria-label={`${priceDisplay}, ${savingsSubline}`}>
          <span className="elite-card__price">{priceDisplay}</span>
          <span className="elite-card__price-arrow" aria-hidden>
            →
          </span>
          <span className="elite-card__save-line">{savingsSubline}</span>
        </div>

        <div className="elite-card__trust-block">
          <div className="elite-card__trust-head">
            <span className="elite-card__trust-title">
              Seller trust: <strong>{trustRounded}/100</strong>
            </span>
            <span className="elite-card__trust-score-pill" aria-hidden>
              {trustRounded}
            </span>
          </div>
          <div
            className="elite-card__trust-segments"
            role="img"
            aria-label={`Seller trust score ${trustRounded} out of 100`}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={
                  i < trustSegments
                    ? "elite-card__trust-seg elite-card__trust-seg--on"
                    : "elite-card__trust-seg"
                }
              />
            ))}
          </div>
        </div>

        {trustResult ? <SavvyTrustPanel trust={trustResult} /> : null}

        <div className="elite-card__badge elite-card__badge--ai" title="AI feeling for this listing">
          {aiFeelingBadge}
        </div>

        {showQuickSnipesPremiumHook && typeof onQuickSnipesPremiumClick === "function" ? (
          <button
            type="button"
            className="elite-card__premium-hook"
            aria-label="Upgrade to compare with Quick Snipes — may find a better deal"
            onClick={onQuickSnipesPremiumClick}
          >
            ⚡ Better deal may exist in Quick Snipes
          </button>
        ) : null}

        <div className="elite-card__actions">
          <div className="elite-card__cta-primary">
            <SavvyAlertButton
              className="elite-card__alert-wrap elite-card__alert-wrap--hero"
              label={alertLabel}
              payload={alertPayload}
            />
          </div>
          <div className="elite-card__cta-row elite-card__cta-row--secondary">
            <button
              type="button"
              data-ftue-save-button={saveDataFtue ? "true" : undefined}
              aria-label={isSaved ? "Remove from saved deals" : "Save this deal to your watchlist"}
              className={`elite-card__btn-save elite-card__btn-save--secondary${
                isSaved ? " elite-card__btn-save--on" : ""
              }`.trim()}
              style={{
                transform: poppedSaved ? "scale(1.06)" : "scale(1)",
              }}
              onClick={onSave}
            >
              <span aria-hidden>⭐</span>
              <span>{isSaved ? "Saved" : "Save"}</span>
            </button>
            {showBidButton ? (
              <button type="button" className="elite-card__btn-bid elite-card__btn-bid--tertiary" onClick={onBidNow}>
                <span className="elite-card__btn-bid-dot" aria-hidden />
                <span>Bid Now</span>
              </button>
            ) : null}
          </div>
          {ebayHref ? (
            <a
              className="elite-card__link-ebay"
              href={ebayHref}
              target="_blank"
              rel="noreferrer"
              onClick={onOpenEbay}
            >
              Open on eBay
            </a>
          ) : null}
        </div>

        {childrenFooter ? <div className="elite-card__footer">{childrenFooter}</div> : null}
      </div>
    </div>
  );
}
