import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, X } from "lucide-react";
import SavvyAlertButton from "../alerts/SavvyAlertButton";
import { getBestListingImageUrl } from "../../lib/listingImageUrl";
import "../../styles/ListingCardImage.css";
import "../../styles/AuctionsSavvyCompareModal.css";

/**
 * @typedef {{
 *   item: any;
 *   trustScore: number;
 *   dealScore: number;
 *   savings: number;
 *   displayPrice: number | null;
 *   marketValue: number | null;
 *   secondsLeft: number;
 *   isAuctionType: boolean;
 *   tier: string;
 *   bestMoveScore: number;
 * }} CompareRow
 */

function toMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function MiniListingCard({ row, badgeLabel, privacyMode = false }) {
  const { item, trustScore, dealScore, savings, displayPrice, secondsLeft, isAuctionType } = row;
  const img = privacyMode ? "/fallback.png" : getBestListingImageUrl(item) || "/fallback.png";
  const title = privacyMode ? "Savvy Best Move (upgrade to reveal)" : item?.title || "Listing";
  const mins = Math.floor(Math.max(0, secondsLeft) / 60);
  const secs = Math.max(0, secondsLeft) % 60;
  const timeDisplay = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <div
      style={{
        background: "#111",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "4/3", background: "#1a1a1a" }}>
        {badgeLabel ? (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 2,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "5px 10px",
              borderRadius: 999,
              background: "rgba(250,204,21,0.22)",
              border: "1px solid rgba(253,224,71,0.45)",
              color: "#fef9c3",
            }}
          >
            {badgeLabel}
          </span>
        ) : null}
        <img
          src={img || "/fallback.png"}
          alt=""
          loading="lazy"
          decoding="async"
          className="f10-listing-img"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <h4 style={{ margin: 0, color: "#fafafa", fontSize: "0.95rem", lineHeight: 1.35 }}>{title}</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13 }}>
          <span style={{ color: "#c7d2fe", fontWeight: 700 }}>Price</span>
          <span style={{ color: "#fff", fontWeight: 800 }}>{privacyMode ? "—" : toMoney(displayPrice)}</span>
          <span style={{ color: "#86efac", fontWeight: 700 }}>Save {privacyMode ? "—" : toMoney(savings)}</span>
        </div>
        <div style={{ fontSize: 13, color: "#a5b4fc" }}>
          Trust{" "}
          <strong style={{ color: "#e0e7ff" }}>{privacyMode ? "—" : `${Math.round(trustScore)}/100`}</strong>
          <span style={{ margin: "0 8px", color: "#475569" }}>·</span>
          Deal score{" "}
          <strong style={{ color: "#e0e7ff" }}>{privacyMode ? "—" : `${dealScore}/100`}</strong>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: isAuctionType ? "#fbbf24" : "#93c5fd" }}>
          {isAuctionType ? `Ends in ${timeDisplay}` : "Buy It Now"}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 6 }}>
          {!privacyMode ? (
            <SavvyAlertButton
              className="alert-btn"
              label="🔔 Create Alert"
              payload={{
                name: `${(item?.title || "Listing").slice(0, 48)} • watch`,
                keywords: [String(item?.title || "").slice(0, 40)],
                maxPrice: displayPrice != null ? Number(displayPrice) : undefined,
                minConfidence: 70,
                persona: "buyer",
                kind: "price_drop",
                context: { source: "auctions_compare_modal", listingId: String(item?.id || "") },
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function lockPageScroll() {
  const y = window.scrollY || window.pageYOffset || 0;
  const body = document.body;
  const prev = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    scrollY: y,
  };
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${y}px`;
  body.style.width = "100%";
  return prev;
}

function unlockPageScroll(prev) {
  if (!prev) return;
  const body = document.body;
  body.style.overflow = prev.overflow;
  body.style.position = prev.position;
  body.style.top = prev.top;
  body.style.width = prev.width;
  window.scrollTo(0, prev.scrollY);
}

export default function AuctionsSavvyCompareModal({
  open,
  onClose,
  userRow,
  savvyRow,
  subTier,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const scrollState = lockPageScroll();
    window.dispatchEvent(new CustomEvent("f10:savvy-wallet-collapse"));
    return () => unlockPageScroll(scrollState);
  }, [open]);

  if (!open || !userRow || !savvyRow) return null;

  const unlocked = subTier !== "free";
  const priority = subTier === "pro" || subTier === "elite";

  return (
    <div
      className="auctions-compare-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="auctions-compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auctions-savvy-compare-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="auctions-compare-header">
          <div className="auctions-compare-header__copy">
            <h2 id="auctions-savvy-compare-title" className="auctions-compare-title">
              Savvy found a stronger move.
            </h2>
            <p className="auctions-compare-subtitle">
              Browse the market free — unlock Savvy+ to reveal the highest-ranked deal.
            </p>
          </div>
          <button
            type="button"
            className="auctions-compare-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div className="auctions-compare-body">
          <div className="auctions-compare-grid">
            <div>
              <div className="auctions-compare-section-label">Here&apos;s what you found</div>
              <MiniListingCard row={userRow} badgeLabel="Strong Pick" />
            </div>

            <div>
              <div className="auctions-compare-section-label auctions-compare-section-label--savvy">
                <Sparkles size={14} aria-hidden />
                Savvy Best Move
              </div>
              {unlocked ? (
                <>
                  <MiniListingCard
                    row={savvyRow}
                    badgeLabel={
                      priority ? "Savvy Best Move Unlocked · Priority" : "Savvy Best Move Unlocked"
                    }
                  />
                  <div className="auctions-compare-unlocked-note">
                    Full Savvy ranking is active on your plan.
                    {priority ? (
                      <span style={{ display: "block", marginTop: 4, color: "#bbf7d0" }}>
                        Priority ranking on.
                      </span>
                    ) : null}
                  </div>
                  <div className="auctions-compare-unlocked-actions">
                    <a
                      href={savvyRow.item?.itemUrl || savvyRow.item?.url}
                      target="_blank"
                      rel="noreferrer"
                      className="auctions-compare-ebay-link"
                    >
                      View on eBay
                    </a>
                    <SavvyAlertButton
                      label="🔔 Alert this deal"
                      payload={{
                        name: `${String(savvyRow.item?.title || "").slice(0, 48)} • Savvy pick`,
                        keywords: [String(savvyRow.item?.title || "").slice(0, 40)],
                        maxPrice:
                          savvyRow.displayPrice != null ? Number(savvyRow.displayPrice) : undefined,
                        minConfidence: 72,
                        persona: "buyer",
                        kind: "price_drop",
                        context: {
                          source: "auctions_savvy_compare_unlocked",
                          listingId: String(savvyRow.item?.id || ""),
                        },
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="auctions-compare-lock-overlay">
                  <div className="auctions-compare-lock-blur" aria-hidden>
                    <MiniListingCard row={savvyRow} badgeLabel="Savvy Best Move" privacyMode />
                  </div>
                  <div className="auctions-compare-lock-panel">
                    <div className="auctions-compare-lock-icon">
                      <Lock size={26} strokeWidth={2.2} />
                    </div>
                    <ul className="auctions-compare-lock-list">
                      <li>Higher trust</li>
                      <li>Better savings</li>
                      <li>Lower competition</li>
                    </ul>
                    <p className="auctions-compare-lock-hint">
                      Get the strongest ranked move, not just the open market.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="auctions-compare-footer">
          {!unlocked ? (
            <Link
              to="/premium?trigger=savvy_plus_auctions_compare"
              className="auctions-compare-btn-upgrade"
            >
              Unlock Savvy+ — $7/mo
            </Link>
          ) : null}
          <button type="button" className="auctions-compare-btn-ghost" onClick={onClose}>
            Keep Browsing
          </button>
        </footer>
      </div>
    </div>
  );
}
