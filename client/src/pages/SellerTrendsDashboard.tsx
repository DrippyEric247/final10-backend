import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  computeCategoryTrends,
  getTrendCoverage,
  subscribeToTrendUpdates,
  TRENDING_SELLER_BONUS_SAVVY,
  TRENDING_SELLER_VISIBILITY_BOOST_PCT,
  type CategoryTrend,
} from "../lib/sellerTrendEngine";
import {
  PREMIUM_FEATURES,
  isPremiumSeller,
} from "../lib/sellerPremium";
import SellerTrendAlerts from "../components/seller/SellerTrendAlerts";
import AutoFlipSuggestions, {
  type AutoFlipSuggestion,
} from "../components/seller/AutoFlipSuggestions";
import ListThisItemAssistantModal from "../components/seller/ListThisItemAssistantModal";
import SellerSignalsPanel from "../components/seller/SellerSignalsPanel";
import type { ListAssistantSeed } from "../lib/listThisItemAssistantEngine";
import SavvyAlertButton from "../components/alerts/SavvyAlertButton";
import { getEbaySellerTrends, getEntitlementsMe } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { SAVVY_SCOUT } from "../config/savvyScoutBranding";
import "../styles/SellerTrendIntel.css";

type EbayTrendComponents = {
  bidCount: number;
  endingSoon: number;
  priceDemand: number;
  categoryFrequency: number;
  listingVolume: number;
};

type EbayHotCategory = {
  id: string;
  label: string;
  trendScore: number;
  components: EbayTrendComponents;
  listingCount: number;
  shareOfSample: number;
  competitionLevel: string;
  competitionCopy: string;
  buyerActivityCopy: string;
  priceRange: {
    min: number;
    max: number;
    median: number | null;
    currency: string;
    label: string;
  } | null;
  bestWindowLabel: string | null;
  postNow: boolean;
  postNowCopy: string;
  hotInCategoryKeywords: string[];
  sampleNote: string;
  sizeIntelligence?: {
    profitableSizes: string[];
    tightSupplyLine: string | null;
    detailNote: string;
  } | null;
};

type EbayHotKeyword = { keyword: string; heat: number };

type EbaySellerTrendsPayload = {
  success?: boolean;
  disclaimer?: string;
  dataSource?: string;
  signalStrength?: string;
  fallbackRecommended?: boolean;
  fetchedAt?: string;
  timeZone?: string;
  hotCategories?: EbayHotCategory[];
  hotKeywords?: EbayHotKeyword[];
  marketplaceBestWindow?: {
    peakHourLocal: number | null;
    label: string | null;
    detail: string | null;
  } | null;
  globalStats?: {
    totalListingsSampled?: number;
    seedsWithApiHits?: number;
    distinctMacroBuckets?: number;
    seedsAttempted?: number;
  };
  message?: string;
  autoFlipSuggestions?: AutoFlipSuggestion[];
};

/**
 * Seller Signals — personalized seller intelligence on `/seller-trends`.
 * Live marketplace lanes plus Final10 motion, filtered and ranked by the
 * seller’s category preferences and on-device engagement weights.
 */
export default function SellerTrendsDashboard() {
  const { user: authUser } = useAuth();
  const [trends, setTrends] = useState<CategoryTrend[]>(() =>
    computeCategoryTrends({ limit: 12 })
  );
  const [coverage, setCoverage] = useState(() => getTrendCoverage());
  const [ebay, setEbay] = useState<EbaySellerTrendsPayload | null>(null);
  const [ebayLoading, setEbayLoading] = useState(true);
  const [pro, setPro] = useState(() => isPremiumSeller());
  const [listAssistSeed, setListAssistSeed] = useState<ListAssistantSeed | null>(null);
  const [creatorMonetization, setCreatorMonetization] = useState<{
    isElite?: boolean;
    isPaidSubscriber?: boolean;
    copy?: { missedSavvy?: string };
  } | null>(null);

  useEffect(() => {
    const onTier = () => setPro(isPremiumSeller());
    window.addEventListener("f10:seller-tier-updated", onTier);
    return () => window.removeEventListener("f10:seller-tier-updated", onTier);
  }, []);

  useEffect(() => {
    if (!authUser) {
      setCreatorMonetization(null);
      return;
    }
    let cancelled = false;
    void getEntitlementsMe()
      .then((d) => {
        if (!cancelled) setCreatorMonetization(d?.creatorMonetization ?? null);
      })
      .catch(() => {
        if (!cancelled) setCreatorMonetization(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const isEliteCreator = Boolean(creatorMonetization?.isElite);
  const isPaidSubscriber = Boolean(creatorMonetization?.isPaidSubscriber);
  const lockSellerAnalytics = Boolean(authUser && (!creatorMonetization || !isEliteCreator));
  const refreshPaid = pro || isPaidSubscriber || isEliteCreator;

  const refreshLocal = useCallback(() => {
    setTrends(computeCategoryTrends({ limit: 12 }));
    setCoverage(getTrendCoverage());
  }, []);

  useEffect(() => {
    const unsub = subscribeToTrendUpdates(refreshLocal);
    const t = window.setInterval(refreshLocal, 60 * 1000);
    return () => {
      unsub();
      window.clearInterval(t);
    };
  }, [refreshLocal]);

  useEffect(() => {
    let cancelled = false;

    const loadEbay = async () => {
      setEbayLoading(true);
      try {
        const data = (await getEbaySellerTrends()) as EbaySellerTrendsPayload;
        if (!cancelled) setEbay(data);
      } catch {
        if (!cancelled) setEbay(null);
      } finally {
        if (!cancelled) setEbayLoading(false);
      }
    };

    void loadEbay();

    const interval =
      refreshPaid ?
        window.setInterval(() => {
          if (!cancelled) void loadEbay();
        }, 60 * 1000)
      : undefined;

    return () => {
      cancelled = true;
      if (interval != null) window.clearInterval(interval);
    };
  }, [refreshPaid]);

  const hotCount = useMemo(() => trends.filter((t) => t.isTrending).length, [trends]);

  const sellerSignalsUserId = useMemo(() => {
    if (!authUser || typeof authUser !== "object") return null;
    const u = authUser as { _id?: string };
    return u._id ? String(u._id) : null;
  }, [authUser]);

  const ebayCats = useMemo(() => ebay?.hotCategories ?? [], [ebay]);
  const ebayKeywords = useMemo(() => ebay?.hotKeywords ?? [], [ebay]);
  const ebayHasGrid = ebayCats.length > 0;
  const showBlendedEmpty = !coverage.hasEnoughData && !ebayHasGrid && !ebayLoading;

  const ebayHotPulse = useMemo(() => {
    if (!ebayHasGrid) return 0;
    return ebayCats.filter((c) => c.trendScore >= 52).length;
  }, [ebayCats, ebayHasGrid]);

  return (
    <div className="seller-trends-wrap">
      <header className="seller-trends-header">
        <div>
          <div className="seller-trends-eyebrow">Seller Signals</div>
          <h1 className="seller-trends-title">Personal AI seller intelligence</h1>
          <p className="seller-trends-sub">
            A clean, actionable pulse — <strong>StockX sharpness</strong>, <strong>TikTok velocity</strong>, and{" "}
            <strong>Bloomberg-grade lanes</strong> without chart noise. Your categories steer the feed; {SAVVY_SCOUT.shortTitle}
            narrates the move.
          </p>
        </div>
        <div className="seller-trends-stats-wrap">
          <div
            className={`seller-trends-stats ${lockSellerAnalytics ? "seller-trends-stats--elite-locked" : ""}`}
          >
            <div className="seller-trends-stat">
              <span className="seller-trends-stat-value">{ebayHotPulse || hotCount}</span>
              <span className="seller-trends-stat-label">Hot lanes right now</span>
            </div>
            <div className="seller-trends-stat">
              <span className="seller-trends-stat-value">
                +{TRENDING_SELLER_BONUS_SAVVY}
              </span>
              <span className="seller-trends-stat-label">Savvy bonus on a hot post</span>
            </div>
            <div className="seller-trends-stat">
              <span className="seller-trends-stat-value">
                +{TRENDING_SELLER_VISIBILITY_BOOST_PCT}%
              </span>
              <span className="seller-trends-stat-label">Extra feed lift</span>
            </div>
          </div>
          {lockSellerAnalytics ? (
            <div className="seller-trends-stats-elite-overlay" aria-live="polite">
              <strong>🔥 This product made creators $2,340 this week</strong>
              <span>Upgrade to Elite to tap in</span>
              <Link to="/premium">🚀 Ready to start earning for real?</Link>
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 12 }}>
          <SavvyAlertButton
            tone="seller"
            label="Ping me when this lane heats up"
            payload={{
              name: "Seller Signals watch",
              keywords: ["sell signals", "seller signals"],
              minConfidence: 70,
              persona: "seller",
              kind: "seller_category_trending",
              context: { source: "seller_trends" },
            }}
          />
        </div>
      </header>

      {ebayLoading ? (
        <p className="seller-trends-ebay-disclaimer" aria-live="polite">
          Pulling the latest money map…
        </p>
      ) : null}

      {!ebayLoading && ebay?.disclaimer ? (
        <div className="seller-trends-ebay-disclaimer" role="note">
          <strong>Live money pulse · </strong>
          {ebay.disclaimer}
          {ebay.globalStats?.totalListingsSampled != null ? (
            <>
              {" "}
              Pulled from <strong>{ebay.globalStats.totalListingsSampled}</strong> live asks
              {ebay.timeZone ? ` · ${ebay.timeZone}` : ""}.
            </>
          ) : null}
        </div>
      ) : null}

      {ebay?.fallbackRecommended ? (
        <div className="seller-trends-ebay-fallback">
          Wider snapshot is {ebay.signalStrength === "weak" ? "thin" : "mixed"} — we&apos;re folding in your
          recent searches and saves below so you still get something actionable.
        </div>
      ) : null}

      {ebayHasGrid ? (
        <>
          {ebayKeywords.length > 0 ? (
            <section aria-label="Hot search phrases">
              <div className="seller-trends-ebay-eyebrow">What buyers are typing</div>
              <ul className="seller-trends-ebay-keywords">
                {ebayKeywords.slice(0, 12).map((k) => (
                  <li key={k.keyword}>
                    <span className="seller-trends-ebay-kw">{k.keyword}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {ebay?.marketplaceBestWindow?.label ? (
            <div className="seller-trends-ebay-window">
              <div className="seller-trends-ebay-window-title">Best hours to drop a listing</div>
              <div className="seller-trends-ebay-window-value">{ebay.marketplaceBestWindow.label}</div>
              <div className="seller-trends-ebay-window-detail">
                {ebay.marketplaceBestWindow.detail}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <SellerSignalsPanel
        userId={sellerSignalsUserId}
        ebayRows={ebayCats}
        localTrends={coverage.hasEnoughData ? trends : []}
        onOpenListingAssistant={(seed) => setListAssistSeed(seed)}
      />

      {ebayHasGrid ? (
        <>
          {authUser &&
          (Number(authUser.flipTotalCompleted) > 0 || authUser.flipBestScoreEver != null) ? (
            <aside className="seller-flip-gamify-strip" aria-label="Your flip record">
              <div className="seller-flip-gamify-title">Your flip run</div>
              <ul className="seller-flip-gamify-stats">
                <li>
                  <span>Best Flip Score ever</span>
                  <strong>
                    {authUser.flipBestScoreEver != null
                      ? Number(authUser.flipBestScoreEver).toFixed(1)
                      : "—"}
                  </strong>
                </li>
                <li>
                  <span>Total flips completed</span>
                  <strong>{Number(authUser.flipTotalCompleted || 0).toLocaleString()}</strong>
                </li>
                <li>
                  <span>Average Flip Score</span>
                  <strong>
                    {authUser.flipAverageScore != null
                      ? Number(authUser.flipAverageScore).toFixed(1)
                      : "—"}
                  </strong>
                </li>
              </ul>
            </aside>
          ) : null}

          <AutoFlipSuggestions
            suggestions={ebay?.autoFlipSuggestions ?? []}
            isPremium={pro || isPaidSubscriber || isEliteCreator}
            eliteFlipAlerts={isEliteCreator}
            onOpenListingAssistant={(flip) => setListAssistSeed({ kind: "flip", flip })}
          />
          {authUser && creatorMonetization != null && !isEliteCreator && !ebayLoading ? (
            <section className="seller-trends-ai-next seller-trends-ai-next--locked" aria-label="Elite AI upsell">
              <h3>AI · What to sell next</h3>
              <p>
                {creatorMonetization.copy?.missedSavvy ?? "You're missing +85 Savvy Points"}{" "}
                — full auto-lanes and voice-grade picks stay on Elite so quality rises instead of spam.
              </p>
              <Link to="/premium">Let Savvy find the money for you →</Link>
            </section>
          ) : null}
        </>
      ) : null}

      {!ebayLoading && !ebayHasGrid && ebay?.message ? (
        <p className="seller-trends-ebay-disclaimer">{ebay.message}</p>
      ) : null}

      {showBlendedEmpty ? (
        <section className="seller-trends-empty">
          <h2>Still warming up your edge…</h2>
          <p>
            We don&apos;t fake heat. Search, save, and browse a little — your personal map appears
            fast, and the wider snapshot fills in when data lands.
          </p>
          <div className="seller-trends-empty-meta">
            {coverage.behaviorEvents} moves tracked · {coverage.searchEvents} hunts logged
          </div>
        </section>
      ) : null}

      {coverage.hasEnoughData ? (
        <>
          <h2 className="seller-trends-local-head">Your playbook from Final10</h2>
          <section className="seller-trends-alerts">
            <SellerTrendAlerts hideUpsell limit={pro ? undefined : 3} />
          </section>
        </>
      ) : null}

      {!coverage.hasEnoughData && ebayHasGrid ? (
        <p className="seller-trends-ebay-window-detail" style={{ marginTop: 16 }}>
          Keep hunting and saving — your personal edge auto-blends with this wider money map.
        </p>
      ) : null}

      <section className="seller-trends-premium" aria-label="Seller Pro preview">
        <div className="seller-trends-premium-head">
          <div className="seller-trends-premium-eyebrow">
            {pro ? "You're on Seller Pro" : "Seller Pro · coming soon"}
          </div>
          <h2 className="seller-trends-premium-title">
            More lanes, faster reads, bigger upside.
          </h2>
        </div>
        <ul className="seller-trends-premium-list">
          {PREMIUM_FEATURES.map((f) => (
            <li
              key={f.id}
              className={`seller-trends-premium-item ${pro ? "is-unlocked" : ""}`}
            >
              <div className="seller-trends-premium-item-label">
                {f.label}
                {pro ? (
                  <span className="seller-trends-premium-chip">Unlocked</span>
                ) : (
                  <span className="seller-trends-premium-chip muted">Soon</span>
                )}
              </div>
              <div className="seller-trends-premium-item-blurb">{f.blurb}</div>
            </li>
          ))}
        </ul>
        <div className="seller-trends-premium-foot">
          <Link to="/promote-listing" className="seller-trends-primary-link">
            Push a hot listing now →
          </Link>
        </div>
      </section>

      <ListThisItemAssistantModal seed={listAssistSeed} onClose={() => setListAssistSeed(null)} />
    </div>
  );
}
