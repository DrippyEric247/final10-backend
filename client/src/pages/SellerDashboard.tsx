/**
 * SellerDashboard — Final10's "trading-terminal" view for sellers.
 *
 * Layout (desktop grid, stacked on mobile):
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ TOP BAR  ·  Savvy today · Active listings · Alignment % │
 *   ├────────────┬──────────────────────┬─────────────────────┤
 *   │ MARKET     │   RECOMMENDED MOVE   │  LIVE SIGNAL FEED   │
 *   │ (trends)   │  (the center punch)  │  (realtime pulse)   │
 *   ├────────────┴──────────────────────┴─────────────────────┤
 *   │ LISTINGS PANEL                                          │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Every number on this page is drawn from a real source — listings via
 * `promotionService.getMyPromotions()`, earnings via `sellerEarnings`
 * (which aggregates real reward events), trends via `sellerTrendEngine`,
 * and the live feed via `sellerSignalFeed`. No fabricated activity.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import promotionService from "../services/promotionService";
import { useAuth } from "../context/AuthContext";
import {
  computeCategoryTrends,
  getTrendCoverage,
  subscribeToTrendUpdates,
  getSellerBonusForCategory,
  type CategoryTrend,
} from "../lib/sellerTrendEngine";
import { useEarningsToday, ensureEarningsTracker } from "../lib/sellerEarnings";
import {
  useSellerSignalFeed,
  formatRelative,
  type SellerSignal,
} from "../lib/sellerSignalFeed";
import "../styles/SellerDashboard.css";
import { incrementJourneyStep } from "../lib/tabJourney";
import SavvyAlertButton from "../components/alerts/SavvyAlertButton";
import LoadingState from "../components/ui/states/LoadingState";
import EmptyState from "../components/ui/states/EmptyState";
import ErrorState from "../components/ui/states/ErrorState";

/* -------------------------------------------------------------- */
/* Types & helpers                                                */
/* -------------------------------------------------------------- */

type PromotionMetrics = {
  impressions?: number;
  clicks?: number;
  ctr?: number;
  saves?: number;
};

type Promotion = {
  _id: string;
  status?: string;
  listingType?: string;
  targetCategory?: string;
  createdAt?: string;
  metrics?: PromotionMetrics;
  promotionPackage?: { name?: string };
  trustScore?: number;
};

function humanize(category: string | null | undefined): string {
  if (!category) return "—";
  const c = String(category).toLowerCase();
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * Trend match: how well a listing's category overlaps the current
 * trending set. 100% = listed in a trending category; scales down to
 * the recentScore / floor ratio for non-trending but still-warm ones.
 */
function computeTrendMatch(category: string | undefined, trends: CategoryTrend[]): number {
  if (!category) return 0;
  const t = trends.find((x) => x.category.toLowerCase() === category.toLowerCase());
  if (!t) return 0;
  if (t.isTrending) return 100;
  if (t.recentScore <= 0) return 0;
  // Scale: anything above floor rounds up, cooler items taper toward 25.
  const ratio = Math.min(1, t.recentScore / 5);
  return Math.round(25 + ratio * 50);
}

/**
 * Demand level shown on the recommended-move card — driven entirely
 * by the trend engine's computed `recentScore` + `delta`.
 */
function demandPresentation(trend: CategoryTrend | undefined): { text: string; level: string } {
  if (!trend) return { text: "Quiet", level: "low" };
  if (trend.isTrending && trend.delta >= 0.5) return { text: "On fire", level: "hot" };
  if (trend.isTrending) return { text: "Strong", level: "high" };
  if (trend.recentScore >= 2) return { text: "Warming up", level: "warming" };
  return { text: "Quiet", level: "low" };
}

function describeCompetition(trend: CategoryTrend | undefined): string {
  if (!trend || trend.competitionLevel === "unknown") return "Still reading the room";
  if (trend.competitionLevel === "low") return "Lighter crowd — easier to win attention";
  if (trend.competitionLevel === "high") return "Crowded — stand out on price & photos";
  return "Some competition — still room to win";
}

/* -------------------------------------------------------------- */
/* Page                                                           */
/* -------------------------------------------------------------- */

export default function SellerDashboard(): JSX.Element {
  const auth = useAuth() as { user?: unknown } | null;
  const user = auth?.user ?? null;
  useEffect(() => {
    incrementJourneyStep("/seller-dashboard", "view_metrics", 1);
    incrementJourneyStep("/seller-dashboard", "review_signals", 1);
  }, []);
  // Install the earnings tracker eagerly so it catches reward events
  // fired during this session regardless of component mount order.
  useEffect(() => {
    ensureEarningsTracker();
  }, []);

  const earnings = useEarningsToday();

  const [trends, setTrends] = useState<CategoryTrend[]>(() => computeCategoryTrends({ limit: 6 }));
  const [coverage, setCoverage] = useState(() => getTrendCoverage());
  useEffect(() => {
    const refresh = () => {
      setTrends(computeCategoryTrends({ limit: 6 }));
      setCoverage(getTrendCoverage());
    };
    const unsub = subscribeToTrendUpdates(refresh);
    const tick = window.setInterval(refresh, 60 * 1000);
    return () => {
      unsub();
      window.clearInterval(tick);
    };
  }, []);

  const feed = useSellerSignalFeed({ limit: 10, windowMinutes: 180 });

  const { data: promotionsData, isLoading: promotionsLoading, isError: promotionsError, refetch: refetchPromotions } = useQuery({
    queryKey: ["seller-dashboard-promotions"],
    queryFn: () => promotionService.getMyPromotions(),
    enabled: !!user,
    staleTime: 60 * 1000,
  });
  const promotions: Promotion[] = useMemo(
    () => (promotionsData?.promotions ?? []) as Promotion[],
    [promotionsData]
  );
  const activeListings = useMemo(
    () => promotions.filter((p) => p.status === "active"),
    [promotions]
  );

  /* ---------- derived top-bar metrics ---------- */

  const alignmentPct = useMemo(() => {
    if (activeListings.length === 0) return 0;
    const matches = activeListings.reduce(
      (sum, p) => sum + computeTrendMatch(p.targetCategory, trends),
      0
    );
    return Math.round(matches / activeListings.length);
  }, [activeListings, trends]);

  /* ---------- recommended move ---------- */

  const recommendation = useMemo(() => {
    const hot = trends.find((t) => t.isTrending) ?? trends[0] ?? null;
    if (!hot) return null;
    const bonus = getSellerBonusForCategory(hot.category);
    const suggestedItem =
      hot.recommendedItems && hot.recommendedItems.length > 0
        ? hot.recommendedItems[0]
        : `Anything in ${humanize(hot.category)}`;
    const demand = demandPresentation(hot);
    return {
      trend: hot,
      suggestedItem,
      demandText: demand.text,
      demandLevel: demand.level,
      competition: describeCompetition(hot),
      bonusSavvy: bonus.bonusSavvy,
      trendingBonus: bonus.trending,
    };
  }, [trends]);

  /* ---------- top trending & windows for market panel ---------- */

  const topTrending = useMemo(() => trends.filter((t) => t.isTrending).slice(0, 4), [trends]);
  const bestWindows = useMemo(
    () =>
      trends
        .filter((t) => t.bestWindowLabel)
        .slice(0, 4)
        .map((t) => ({
          category: t.category,
          window: t.bestWindowLabel as string,
          hot: t.isTrending,
        })),
    [trends]
  );

  /* -------------------------------------------------------------- */
  /* Render                                                         */
  /* -------------------------------------------------------------- */

  return (
    <div className="seller-dash-wrap">
      <div className="seller-dash-inner">
        <header className="seller-dash-header">
          <div>
            <div className="seller-dash-eyebrow">Seller command</div>
            <h1 className="seller-dash-title">
              Where the money moves. <span className="accent">Your lane.</span>
            </h1>
            <p className="seller-dash-sub">
              Real demand, trust, and timing — no theater, just the signals that pay.
            </p>
          </div>
        </header>

        {/* ==========  TOP BAR  ========== */}
        <section className="seller-dash-topbar" aria-label="Key seller metrics">
          <Metric
            label="Savvy earned today"
            value={earnings.totalToday.toLocaleString()}
            sub={earnings.hasActivity ? `${earnings.buyer} buyer · ${earnings.seller} seller` : "Start a move to earn"}
            tone={earnings.hasActivity ? "accent" : "muted"}
          />
          <Metric
            label="Live asks out"
            value={activeListings.length.toString()}
            sub={promotions.length ? `${promotions.length} packs total` : "Nothing live yet"}
            tone="default"
          />
          <Metric
            label="Demand fit"
            value={`${alignmentPct}%`}
            sub={
              activeListings.length === 0
                ? "List once to score this"
                : alignmentPct >= 70
                ? "Locked onto hot demand"
                : alignmentPct >= 40
                ? "Mixed — tighten your lane"
                : "Shift toward a hotter category"
            }
            tone={alignmentPct >= 70 ? "good" : alignmentPct >= 40 ? "warn" : "muted"}
          />
        </section>

        {/* ==========  MAIN GRID  ========== */}
        <section className="seller-dash-grid">
          {/* -------- MARKET PANEL -------- */}
          <article className="seller-dash-card market-panel" aria-label="Money map">
            <header className="panel-head">
              <h2>Money map</h2>
              <span className="panel-tag">Live</span>
            </header>

            <div className="panel-section">
              <h3 className="panel-sub">Hot lanes</h3>
              {coverage.hasEnoughData && topTrending.length > 0 ? (
                <ul className="trend-list">
                  {topTrending.map((t) => (
                    <li key={t.category} className="trend-row">
                      <span className="trend-dot" aria-hidden />
                      <span className="trend-name">{humanize(t.category)}</span>
                      <span className="trend-delta">
                        ↑ {Math.round(Math.max(0, t.delta) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  className="f10-state--inline panel-empty"
                  title={coverage.hasEnoughData ? "Lanes are quiet" : "Still learning you"}
                  description={
                    coverage.hasEnoughData
                      ? "Check back after the next scroll wave."
                      : "Browse, save, and hunt — this map lights up as you move."
                  }
                />
              )}
            </div>

            <div className="panel-section">
              <h3 className="panel-sub">Best hours to post</h3>
              {bestWindows.length > 0 ? (
                <ul className="window-list">
                  {bestWindows.map((w) => (
                    <li key={w.category} className={`window-row ${w.hot ? "is-hot" : ""}`}>
                      <span className="window-name">{humanize(w.category)}</span>
                      <span className="window-time">{w.window}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  className="f10-state--inline panel-empty"
                  title="Peak hours pending"
                  description="Need a bit more motion before we call the best posting windows."
                />
              )}
            </div>
          </article>

          {/* -------- RECOMMENDED MOVE (CENTER) -------- */}
          <article className="seller-dash-card recommended-card" aria-label="Your best seller move">
            <header className="panel-head">
              <h2>Your best move right now</h2>
              {recommendation?.trendingBonus && (
                <span className="panel-tag panel-tag-hot">Bonus live</span>
              )}
            </header>

            {recommendation ? (
              <div className="reco-body">
                <div className="reco-suggest">
                  <div className="reco-category">{humanize(recommendation.trend.category)}</div>
                  <div className="reco-item">{recommendation.suggestedItem}</div>
                </div>

                <dl className="reco-stats">
                  <div>
                    <dt>Money heat</dt>
                    <dd data-level={recommendation.demandLevel}>{recommendation.demandText}</dd>
                  </div>
                  <div>
                    <dt>Your edge</dt>
                    <dd>{recommendation.competition}</dd>
                  </div>
                  <div>
                    <dt>Savvy kicker</dt>
                    <dd className="bonus">
                      {recommendation.bonusSavvy > 0 ? `+${recommendation.bonusSavvy}` : "—"}
                    </dd>
                  </div>
                </dl>

                {recommendation.trend.callToAction && (
                  <p className="reco-cta-copy">{recommendation.trend.callToAction}</p>
                )}

                <Link
                  to={`/promote-listing?category=${encodeURIComponent(recommendation.trend.category)}`}
                  className="reco-cta-btn"
                  onClick={() => incrementJourneyStep("/seller-dashboard", "open_listing_cta", 1)}
                >
                  List it now
                </Link>
                <div className="seller-dash-alert-wrap">
                  <SavvyAlertButton
                    tone="seller"
                    label="Watch this for me"
                    payload={{
                      name: `Sell signal • ${recommendation.trend.category}`,
                      keywords: [recommendation.trend.category],
                      minConfidence: 70,
                      persona: "seller",
                      kind: "seller_category_trending",
                      context: { source: "seller_dashboard", category: recommendation.trend.category },
                    }}
                  />
                </div>
              </div>
            ) : (
              <EmptyState
                className="f10-state--inline panel-empty reco-empty"
                title="No loud signal yet"
                description="Browse or drop a listing to wake the map."
                action={
                  <Link
                    to="/promote-listing"
                    className="reco-cta-btn reco-cta-btn-ghost"
                    onClick={() => incrementJourneyStep("/seller-dashboard", "open_listing_cta", 1)}
                  >
                    Start earning clicks
                  </Link>
                }
              />
            )}
          </article>

          {/* -------- LIVE SIGNAL FEED -------- */}
          <article className="seller-dash-card signal-card" aria-label="Live money pulse">
            <header className="panel-head">
              <h2>Live pulse</h2>
              <span className="panel-tag panel-tag-live">
                <span className="live-dot" aria-hidden /> now
              </span>
            </header>

            {feed.length === 0 ? (
              <EmptyState
                className="f10-state--inline panel-empty"
                title="Quiet feed"
                description="Shoppers haven't moved enough yet for fresh pings."
              />
            ) : (
              <ul className="signal-list">
                {feed.map((s) => (
                  <SignalRow key={s.id} signal={s} />
                ))}
              </ul>
            )}
          </article>
        </section>

        {/* ==========  LISTINGS PANEL  ========== */}
        <section className="seller-dash-card listings-card" aria-label="Your live asks">
          <header className="panel-head">
            <h2>Your live asks</h2>
            <Link to="/promote-listing" className="panel-link">
              + New pack
            </Link>
          </header>

          {promotionsLoading ? (
            <LoadingState variant="inline" label="Loading your listings…" className="listings-loading" />
          ) : promotionsError ? (
            <ErrorState
              className="f10-state--inline listings-empty"
              title="Couldn't load listings"
              description="Your promotion data didn't load. Try again in a moment."
              error={promotionsError}
              onRetry={() => void refetchPromotions()}
            />
          ) : promotions.length === 0 ? (
            <EmptyState
              className="f10-state--inline panel-empty listings-empty"
              title="No asks live yet"
              description="First click funds the next play."
              action={
                <Link to="/promote-listing" className="reco-cta-btn reco-cta-btn-ghost">
                  List your first item
                </Link>
              }
            />
          ) : (
            <div className="listings-table" role="table">
              <div className="listings-row listings-row-head" role="row">
                <span role="columnheader">Pack</span>
                <span role="columnheader">Lane</span>
                <span role="columnheader">Eyeballs</span>
                <span role="columnheader">Clicks</span>
                <span role="columnheader">Trust</span>
                <span role="columnheader">Demand fit</span>
              </div>
              {promotions.slice(0, 8).map((p) => {
                const match = computeTrendMatch(p.targetCategory, trends);
                const views = Number(p.metrics?.impressions) || 0;
                const clicks = Number(p.metrics?.clicks) || Number(p.metrics?.saves) || 0;
                const trust = Number(p.trustScore);
                return (
                  <div key={p._id} className="listings-row" role="row">
                    <span className="listings-title" role="cell">
                      {p.promotionPackage?.name || p.listingType || "Listing"}
                      <span className={`listings-status listings-status--${p.status || "active"}`}>
                        {p.status || "active"}
                      </span>
                    </span>
                    <span role="cell">{humanize(p.targetCategory)}</span>
                    <span role="cell">{views.toLocaleString()}</span>
                    <span role="cell">{clicks.toLocaleString()}</span>
                    <span role="cell">
                      {Number.isFinite(trust) && trust > 0 ? `${Math.round(trust)}` : "—"}
                    </span>
                    <span role="cell">
                      <MatchBar value={match} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Small presentational components                                */
/* -------------------------------------------------------------- */

type MetricProps = {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "accent" | "good" | "warn" | "muted";
};

function Metric({ label, value, sub, tone = "default" }: MetricProps): JSX.Element {
  return (
    <div className={`seller-dash-metric tone-${tone}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function MatchBar({ value }: { value: number }): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  const tone = clamped >= 70 ? "good" : clamped >= 40 ? "warn" : "low";
  return (
    <span className={`match-bar tone-${tone}`} title={`${clamped}% demand fit`}>
      <span className="match-bar-fill" style={{ width: `${clamped}%` }} />
      <span className="match-bar-val">{clamped}%</span>
    </span>
  );
}

function SignalRow({ signal }: { signal: SellerSignal }): JSX.Element {
  return (
    <li className={`signal-row signal-row--${signal.kind}`}>
      <span className="signal-icon" aria-hidden>
        {signal.icon ?? "•"}
      </span>
      <span className="signal-main">
        <span className="signal-head">{signal.headline}</span>
        {signal.detail && <span className="signal-detail">{signal.detail}</span>}
      </span>
      <span className="signal-time">{formatRelative(signal.ts)}</span>
    </li>
  );
}
