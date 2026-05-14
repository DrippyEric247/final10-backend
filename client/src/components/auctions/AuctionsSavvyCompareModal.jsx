import React from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, X } from "lucide-react";
import SavvyAlertButton from "../alerts/SavvyAlertButton";
import { getBestListingImageUrl } from "../../lib/listingImageUrl";
import "../../styles/ListingCardImage.css";

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

export default function AuctionsSavvyCompareModal({
  open,
  onClose,
  userRow,
  savvyRow,
  subTier,
}) {
  if (!open || !userRow || !savvyRow) return null;

  const unlocked = subTier !== "free";
  const priority = subTier === "pro" || subTier === "elite";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 135,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.72)",
      }}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auctions-savvy-compare-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 980,
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: 20,
          border: "1px solid rgba(129,140,248,0.35)",
          background: "linear-gradient(165deg, rgba(15,23,42,0.98), rgba(17,24,39,0.99))",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          padding: "22px 22px 20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div>
            <h2 id="auctions-savvy-compare-title" style={{ margin: 0, color: "#f8fafc", fontSize: "1.35rem", fontWeight: 800 }}>
              Savvy found a stronger move.
            </h2>
            <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 14, lineHeight: 1.5, maxWidth: 640 }}>
              Browse the market free — unlock Savvy+ to reveal the highest-ranked deal.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              flexShrink: 0,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(15,23,42,0.6)",
              color: "#e2e8f0",
              borderRadius: 10,
              padding: 8,
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
            alignItems: "stretch",
          }}
        >
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>
              Here&apos;s what you found
            </div>
            <MiniListingCard row={userRow} badgeLabel="Strong Pick" />
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#c4b5fd",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
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
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#86efac",
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(74,222,128,0.35)",
                  }}
                >
                  Full Savvy ranking is active on your plan.
                  {priority ? (
                    <span style={{ display: "block", marginTop: 4, color: "#bbf7d0" }}>
                      Priority ranking on.
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <a
                    href={savvyRow.item?.itemUrl || savvyRow.item?.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "10px 16px",
                      borderRadius: 10,
                      background: "linear-gradient(135deg,#6366f1,#a855f7)",
                      color: "#fff",
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
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
                      context: { source: "auctions_savvy_compare_unlocked", listingId: String(savvyRow.item?.id || "") },
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
                <div style={{ filter: "blur(9px)", opacity: 0.42, transform: "scale(1.02)", pointerEvents: "none" }} aria-hidden>
                  <MiniListingCard row={savvyRow} badgeLabel="Savvy Best Move" privacyMode />
                </div>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    background: "linear-gradient(180deg, rgba(15,23,42,0.25), rgba(15,23,42,0.88))",
                    padding: 20,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(99,102,241,0.25)",
                      border: "1px solid rgba(165,180,252,0.45)",
                      color: "#e0e7ff",
                    }}
                  >
                    <Lock size={26} strokeWidth={2.2} />
                  </div>
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      color: "#cbd5e1",
                      fontSize: 14,
                      fontWeight: 600,
                      lineHeight: 1.7,
                    }}
                  >
                    <li>Higher trust</li>
                    <li>Better savings</li>
                    <li>Lower competition</li>
                  </ul>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", maxWidth: 280, lineHeight: 1.45 }}>
                    Get the strongest ranked move, not just the open market.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          {!unlocked ? (
            <Link
              to="/premium?trigger=savvy_plus_auctions_compare"
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg,#facc15,#a855f7)",
                color: "#1a0f24",
                fontWeight: 900,
                textDecoration: "none",
              }}
            >
              Unlock Savvy+ — $7/mo
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.45)",
              background: "transparent",
              color: "#e2e8f0",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Keep Browsing
          </button>
        </div>
      </div>
    </div>
  );
}
