import React, { useMemo, useState } from "react";
import FlipProfitCalculatorModal from "./FlipProfitCalculatorModal";
import FlipScoreCallout, { type FlipScoreTier } from "./FlipScoreCallout";
import { Link } from "react-router-dom";
import type { FlipForAssistant } from "../../lib/listThisItemAssistantEngine";
import { estimateMaxSavvyPointsForFlip } from "../../lib/flipSavvyPotential";

export type AutoFlipSuggestion = {
  itemId: string;
  title: string;
  itemWebUrl: string | null;
  currency: string;
  categoryId: string;
  categoryLabel: string;
  buyPrice: number;
  estimatedResellPrice: number;
  profitDollars: number;
  profitPct: number;
  confidence: "low" | "medium" | "high";
  competitionLevel: string;
  competitionCopy: string;
  bidCount: number;
  flipScore?: number;
  flipScoreTier?: FlipScoreTier;
  flipScoreLabel?: string;
  flipScoreWhy?: string;
};

type Props = {
  suggestions: AutoFlipSuggestion[];
  /** Paid (Premium/VIP) — unlocks full under-9.0 grid; Elite adds 9.0+ alerts. */
  isPremium: boolean;
  /** Elite creator — 9.0+ flip alerts + full Savvy upside lines. */
  eliteFlipAlerts?: boolean;
  onOpenListingAssistant?: (flip: FlipForAssistant) => void;
};

function money(currency: string, n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

function topTwoUnlockedIds(sorted: AutoFlipSuggestion[]): Set<string> {
  const byCat = new Map<string, AutoFlipSuggestion[]>();
  for (const s of sorted) {
    const list = byCat.get(s.categoryId) ?? [];
    list.push(s);
    byCat.set(s.categoryId, list);
  }
  const allowed = new Set<string>();
  for (const arr of byCat.values()) {
    const local = [...arr].sort((a, b) => {
      const as = a.flipScore ?? -1;
      const bs = b.flipScore ?? -1;
      if (bs !== as) return bs - as;
      return b.profitDollars - a.profitDollars;
    });
    for (const row of local.slice(0, 2)) {
      allowed.add(row.itemId);
    }
  }
  return allowed;
}

function flipSavvyUpsideLine(row: AutoFlipSuggestion, showFullSavvy: boolean) {
  if (row.flipScore == null || !Number.isFinite(row.flipScore)) return null;
  const max = estimateMaxSavvyPointsForFlip({
    flipScore: row.flipScore,
    fromAi: true,
    isPremium: showFullSavvy,
  });
  return (
    <p className="seller-flip-savvy-potential">
      This flip could earn you up to +{max} Savvy Points
    </p>
  );
}

function confidenceClass(c: AutoFlipSuggestion["confidence"]) {
  if (c === "high") return "seller-flip-confidence--high";
  if (c === "medium") return "seller-flip-confidence--medium";
  return "seller-flip-confidence--low";
}

export default function AutoFlipSuggestions({
  suggestions,
  isPremium,
  eliteFlipAlerts = false,
  onOpenListingAssistant,
}: Props) {
  const [calcDeal, setCalcDeal] = useState<AutoFlipSuggestion | null>(null);

  const sorted = useMemo(() => {
    const next = [...suggestions];
    next.sort((a, b) => {
      const as = a.flipScore ?? -1;
      const bs = b.flipScore ?? -1;
      if (bs !== as) return bs - as;
      return b.profitDollars - a.profitDollars;
    });
    return next;
  }, [suggestions]);

  const eliteLane = useMemo(
    () => sorted.filter((s) => (s.flipScore ?? 0) >= 9),
    [sorted]
  );

  const pool = useMemo(
    () => (eliteFlipAlerts ? sorted : sorted.filter((s) => (s.flipScore ?? 0) < 9)),
    [sorted, eliteFlipAlerts]
  );

  const showFullSavvyLine = Boolean(eliteFlipAlerts || isPremium);

  const unlockedIds = useMemo(() => {
    if (isPremium) return null;
    return topTwoUnlockedIds(pool);
  }, [isPremium, pool]);

  const best = pool[0];
  const gridRows = pool.length > 1 ? pool.slice(1) : [];

  if (pool.length === 0 && eliteLane.length === 0) {
    return (
      <section className="seller-flip-section" aria-label="Auto flip suggestions">
        <header className="seller-flip-section-head">
          <div className="seller-flip-eyebrow">Flip radar</div>
          <h2 className="seller-flip-title">Buy low, sell higher</h2>
          <p className="seller-flip-sub">
            We hunt asks sitting under what similar items fetch — then sketch your upside if demand
            holds. Nothing juicy in this scan yet; refresh after the next pulse.
          </p>
        </header>
      </section>
    );
  }

  const openCalc = (row: AutoFlipSuggestion) => {
    setCalcDeal(row);
  };

  return (
    <section className="seller-flip-section" aria-label="Auto flip suggestions">
      <header className="seller-flip-section-head">
        <div className="seller-flip-eyebrow-row">
          <span className="seller-flip-eyebrow">Flip radar</span>
          {isPremium || eliteFlipAlerts ? (
            <span className="seller-flip-live-pill" title="Fresh asks about every minute">
              Live pulse
            </span>
          ) : null}
        </div>
        <h2 className="seller-flip-title">Buy low, sell higher</h2>
        <p className="seller-flip-sub">
          Buys sitting <strong>under what similar asks are getting</strong>, with a resell target
          anchored to <strong>what people are paying</strong> in the same lane. Fees and ship are on
          you — this is your sketch, not the final math.
        </p>
      </header>

      {!best && eliteLane.length > 0 ? (
        <p className="seller-flip-elite-empty-pool" style={{ marginTop: 4 }}>
          This pulse is <strong>all 9.0+ scored asks</strong> — your public radar stops at 8.9 so the real money
          moves stay Elite-only.
        </p>
      ) : null}

      {best ? (
        <div className="seller-flip-hero" role="status">
          <div className="seller-flip-hero-badge">Top flip this scan</div>
          <FlipScoreCallout row={best} variant="hero" />
          {flipSavvyUpsideLine(best, showFullSavvyLine)}
          <div className="seller-flip-hero-title">{best.title}</div>
          <div className="seller-flip-hero-meta">
            <span>
              In at {money(best.currency, best.buyPrice)} → aim {money(best.currency, best.estimatedResellPrice)}
            </span>
            <span className="seller-flip-hero-profit">
              +{money(best.currency, best.profitDollars)} / +{best.profitPct}%
            </span>
          </div>
          <div className="seller-flip-hero-actions">
            {onOpenListingAssistant ? (
              <button
                type="button"
                className="seller-flip-btn seller-flip-btn--secondary"
                onClick={() => onOpenListingAssistant(best)}
              >
                List this item now
              </button>
            ) : null}
            <button type="button" className="seller-flip-btn seller-flip-btn--secondary" onClick={() => openCalc(best)}>
              Calculate profit
            </button>
            {best.itemWebUrl ? (
              <a
                className="seller-flip-btn"
                href={best.itemWebUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Deal
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="seller-flip-grid">
        {gridRows.map((row) => {
          const locked = !isPremium && unlockedIds && !unlockedIds.has(row.itemId);
          return (
            <article
              key={row.itemId}
              className={`seller-flip-card ${locked ? "seller-flip-card--locked" : "seller-flip-card--opens-calc"}`}
              aria-label={row.title}
              onClick={locked ? undefined : () => openCalc(row)}
            >
              <div className="seller-flip-card-inner">
                <div className="seller-flip-card-top">
                  <h3 className="seller-flip-card-title">{row.title}</h3>
                  <span className="seller-flip-cat">{row.categoryLabel}</span>
                  <FlipScoreCallout row={row} variant="card" />
                  {flipSavvyUpsideLine(row, showFullSavvyLine)}
                </div>
                <dl className="seller-flip-dl">
                  <div>
                    <dt>Your buy-in</dt>
                    <dd>{money(row.currency, row.buyPrice)}</dd>
                  </div>
                  <div>
                    <dt className="seller-flip-dt-natural">What people are paying</dt>
                    <dd>{money(row.currency, row.estimatedResellPrice)}</dd>
                  </div>
                  <div>
                    <dt>Upside</dt>
                    <dd className="seller-flip-profit">
                      +{money(row.currency, row.profitDollars)} / +{row.profitPct}%
                    </dd>
                  </div>
                  <div>
                    <dt>Your edge</dt>
                    <dd>{row.competitionCopy}</dd>
                  </div>
                </dl>
                <div className="seller-flip-card-foot">
                  <span
                    className={`seller-flip-confidence ${confidenceClass(row.confidence)}`}
                    title="How tight this read is — bids, spread, and crowd in this scan"
                    aria-label={`Confidence ${row.confidence}`}
                  >
                    {row.confidence === "high"
                      ? "High"
                      : row.confidence === "medium"
                        ? "Medium"
                        : "Low"}
                  </span>
                  <div className="seller-flip-card-actions">
                    {onOpenListingAssistant ? (
                      <button
                        type="button"
                        className="seller-flip-btn seller-flip-btn--secondary seller-flip-btn--compact"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenListingAssistant(row);
                        }}
                      >
                        List now
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="seller-flip-btn seller-flip-btn--secondary seller-flip-btn--compact"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCalc(row);
                      }}
                    >
                      Calculate profit
                    </button>
                    {row.itemWebUrl ? (
                      <a
                        className="seller-flip-btn seller-flip-btn--compact"
                        href={row.itemWebUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Deal
                      </a>
                    ) : (
                      <span className="seller-flip-btn seller-flip-btn--disabled seller-flip-btn--compact">
                        View Deal
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {locked ? (
                <div className="seller-flip-lock-overlay">
                  <p className="seller-flip-lock-msg">💰 This is where creators get paid</p>
                  <Link to="/premium" className="seller-flip-lock-link">
                    🚀 Ready to start earning for real? →
                  </Link>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {!eliteFlipAlerts && eliteLane.length > 0 ? (
        <section className="seller-flip-elite-lane" aria-label="Elite flip alerts teaser">
          <div className="seller-flip-elite-lane-head">
            <span className="seller-flip-elite-pill">9.0+ Flip lane</span>
            <h3 className="seller-flip-elite-title">Elite-only money signals</h3>
            <p className="seller-flip-elite-sub">
              {eliteLane.length} scored {eliteLane.length === 1 ? "ask" : "asks"} at 9.0+ are hidden here — the same
              alerts paying creators use to move first.
            </p>
          </div>
          <div className="seller-flip-elite-blur-grid">
            {eliteLane.slice(0, 3).map((row) => (
              <div key={row.itemId} className="seller-flip-elite-blur-card">
                <div className="seller-flip-elite-blur-inner">
                  <span className="seller-flip-elite-blur-score">{(row.flipScore ?? 0).toFixed(1)}</span>
                  <p className="seller-flip-elite-blur-title">{row.title}</p>
                  <p className="seller-flip-elite-blur-profit">
                    +{money(row.currency, row.profitDollars)} est.
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="seller-flip-elite-cta-copy">Let Savvy find the money for you</p>
          <Link to="/premium" className="seller-flip-elite-cta">
            Upgrade to Elite to tap in →
          </Link>
        </section>
      ) : null}

      {calcDeal ? (
        <FlipProfitCalculatorModal
          key={calcDeal.itemId}
          deal={calcDeal}
          onClose={() => setCalcDeal(null)}
        />
      ) : null}
    </section>
  );
}
