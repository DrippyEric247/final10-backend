import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { notifyUniversalProgressRefresh } from "../lib/universalBoostProgress";
import { recordSkillGem } from "../lib/final10PowerEngine";
import { POWER_UX } from "../lib/final10PowerConfig";
import { emitPowerToast } from "../lib/final10PowerFeedback";
import { pushAssistantSignal } from "../lib/assistantSignals";
import { reportDealsForAlerts } from "../lib/smartDealAlerts";
import { trackCategoryView, trackItemClick } from "../lib/userBehavior";
import { recordBattlePassXp } from "../lib/battlePassEngine";
import { triggerActionReward } from "../lib/rewardEngine";
import ListingIntentAnchor from "../components/ListingIntentAnchor";
import SavvyRewardBadge from "../components/rewards/SavvyRewardBadge";
import { evaluateTrustScore, trustScoreInputFromListing } from "../lib/trustScoreEngine";
import { groupByBestMove } from "../lib/listingSectionsEngine";
import ListingSections, { MoveTierBadge } from "../components/listings/ListingSections";
import ListingCardImage from "../components/listings/ListingCardImage";
import {
  buildDynamicFeedSections,
  markDynamicFeedItemsShown,
  mergeHistoricalPoolFromSorted,
  bumpSessionShuffleSeed,
  getOrCreateSessionShuffleSeed,
  itemFeedId,
  STILL_WORTH_LOOK_LABEL,
} from "../lib/dynamicTrendingFeed";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import ebayService from "../services/ebayService";
import promotionService from "../services/promotionService";
import SavvyAlertButton from "../components/alerts/SavvyAlertButton";
import { useAuth } from "../context/AuthContext";
import { emitTourAction } from "../lib/tourGuide";
import { hasCompletedFirstSixty } from "../lib/firstRunState";
import { incrementJourneyStep } from "../lib/tabJourney";
import { getEffectiveSubscriptionTier } from "../lib/tierMultiplier";
import "../styles/ProductFeed.css";

const FEED_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "electronics", label: "Electronics" },
  { id: "gaming", label: "Gaming" },
  { id: "sneakers", label: "Sneakers" },
  { id: "fashion", label: "Fashion" },
  { id: "collectibles", label: "Collectibles" },
  { id: "home", label: "Home" },
  { id: "auto", label: "Auto" },
];

const ALL_MIX_CATEGORIES = [
  "electronics",
  "gaming",
  "sneakers",
  "fashion",
  "collectibles",
  "home",
  "auto",
  "luxury",
];

const CATEGORY_QUERY_MAP = {
  electronics: ["electronics", "apple", "laptop", "smartphone"],
  gaming: ["gaming", "ps5", "xbox", "nintendo switch"],
  sneakers: ["sneakers", "nike", "adidas", "jordans"],
  fashion: ["fashion", "streetwear", "designer bag", "jacket"],
  collectibles: ["collectibles", "pokemon", "sports cards", "vintage"],
  home: ["home", "kitchen", "furniture", "decor"],
  auto: ["auto", "car parts", "automotive", "detailing"],
  luxury: ["luxury watch", "rolex", "omega", "designer"],
};

const SMART_CART_BLUEPRINTS = {
  gaming: [
    { key: "psvr2", label: "PSVR2", section: "ai", tags: ["psvr", "vr", "playstation"] },
    { key: "dualsense", label: "DualSense Edge Controller", section: "bundle", tags: ["dualsense", "controller", "ps5"] },
    { key: "headset", label: "Gaming Headset", section: "lowComp", tags: ["headset", "audio", "gaming"] },
    { key: "ssd", label: "SSD Expansion", section: "finish", tags: ["ssd", "nvme", "storage"] },
  ],
  sneakers: [
    { key: "cleaner", label: "Sneaker Cleaner Kit", section: "ai", tags: ["cleaner", "shoe care"] },
    { key: "display", label: "Display Shelf", section: "premium", tags: ["display", "shelf"] },
    { key: "apparel", label: "Matching Apparel", section: "bundle", tags: ["hoodie", "tee", "streetwear"] },
    { key: "containers", label: "Stackable Sneaker Containers", section: "finish", tags: ["container", "box"] },
  ],
  auto: [
    { key: "spacers", label: "BMW Wheel Spacers", section: "ai", tags: ["spacer", "bmw"] },
    { key: "trim", label: "Carbon Trim Kit", section: "premium", tags: ["carbon", "trim"] },
    { key: "audio", label: "BMW Audio Upgrade", section: "bundle", tags: ["audio", "amp", "speaker"] },
    { key: "caps", label: "Wheel Center Caps", section: "finish", tags: ["wheel", "cap"] },
  ],
  luxury: [
    { key: "winder", label: "Watch Winder", section: "premium", tags: ["winder", "watch"] },
    { key: "case", label: "Storage Case", section: "ai", tags: ["case", "watch box"] },
    { key: "strap", label: "Premium Strap", section: "lowComp", tags: ["strap", "bracelet"] },
    { key: "tool", label: "Maintenance Tool Set", section: "finish", tags: ["tool", "watch"] },
  ],
  electronics: [
    { key: "monitor", label: "Gaming Monitor", section: "bundle", tags: ["monitor", "display"] },
    { key: "dock", label: "Charging Dock", section: "ai", tags: ["dock", "charger"] },
    { key: "protection", label: "Protection Plan", section: "lowComp", tags: ["warranty", "plan"] },
    { key: "stand", label: "Cooling Stand", section: "finish", tags: ["cooling", "stand"] },
  ],
};

const MOST_COMPLETED_SETUPS = [
  { id: "ps5", label: "🎮 Ultimate PS5 Setup", category: "gaming" },
  { id: "pc", label: "💻 Budget Gaming Beast", category: "electronics" },
  { id: "sneaker", label: "👟 Sneaker Reseller Starter Pack", category: "sneakers" },
  { id: "bmw", label: "🔊 BMW Audio Upgrade Kit", category: "auto" },
];

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCategory(item, requestedCategory = "all") {
  const raw = String(item.category || item.categoryName || item.categoryId || "").toLowerCase();
  const title = String(item.title || "").toLowerCase();
  if (requestedCategory !== "all") return requestedCategory;
  if (raw.includes("sneaker") || /nike|adidas|jordan/.test(title)) return "sneakers";
  if (raw.includes("fashion") || raw.includes("clothing") || /jacket|dress|hoodie|streetwear/.test(title)) return "fashion";
  if (raw.includes("collect") || /pokemon|card|vintage|memorabilia/.test(title)) return "collectibles";
  if (raw.includes("auto") || raw.includes("vehicle") || /automotive|car part|detailing/.test(title)) return "auto";
  if (raw.includes("home") || raw.includes("furniture") || /kitchen|decor|sofa|desk/.test(title)) return "home";
  if (raw.includes("game") || /ps5|xbox|nintendo|gaming/.test(title)) return "gaming";
  if (/watch|rolex|omega|luxury/.test(title)) return "luxury";
  return "electronics";
}

function computeTrendingSignals(item, category) {
  const bids = toNum(item.bids ?? item.bidCount);
  const scoreObj = item.aiScore && typeof item.aiScore === "object" ? item.aiScore : {};
  const aiTrending = toNum(scoreObj.trendingScore);
  const dealPotential = toNum(scoreObj.dealPotential);
  const confidenceBoost = toNum(item.confidenceScore) * 100;
  const endingSoonSeconds = toNum(item.timeRemaining ?? item.secondsRemaining);
  const buyNowOnly = item.isBuyNow && !item.isAuction;
  const endingSoonBoost =
    endingSoonSeconds > 0 && endingSoonSeconds <= 3600 ? 18 :
    endingSoonSeconds > 0 && endingSoonSeconds <= 10800 ? 10 : 0;
  const bidBoost = Math.min(22, bids * 2.5);
  const buyNowBoost = buyNowOnly ? 8 : 0;
  const categoryMomentum = ["gaming", "sneakers", "collectibles", "luxury"].includes(category) ? 10 : 6;
  const trendingScore = Math.max(
    35,
    Math.min(
      99,
      Math.round((aiTrending * 0.45) + (dealPotential * 0.2) + (confidenceBoost * 0.1) + bidBoost + endingSoonBoost + buyNowBoost + categoryMomentum)
    )
  );
  let trendingReason = `Trending in ${category.charAt(0).toUpperCase()}${category.slice(1)}`;
  if (bids >= 10) trendingReason = "High bid activity";
  else if (buyNowOnly && trendingScore >= 78) trendingReason = "Fast-moving Buy Now";
  else if (endingSoonBoost >= 10) trendingReason = "Recent surge in activity";
  const trendingLabel = trendingScore >= 86 ? "Hot now" : trendingScore >= 70 ? "Trending" : "Rising";
  return { trendingScore, trendingLabel, trendingReason };
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter((it) => {
    const id = String(it.id || it.itemId || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function fetchFeed({ pageParam, queryKey }) {
  const [, selectedCategory] = queryKey;
  const page = pageParam || 1;
  const rotation = (page - 1) % 4;
  try {
    let mixedItems = [];
    if (selectedCategory === "all") {
      const categories = ALL_MIX_CATEGORIES;
      const requests = categories.map(async (cat) => {
        const querySeed = CATEGORY_QUERY_MAP[cat] || [cat];
        const q = querySeed[(rotation + cat.length) % querySeed.length];
        const data = await ebayService.searchItems({
          q,
          categoryId: cat,
          listingMode: "mixed",
          page,
          limit: 6,
          sortOrder: rotation % 2 === 0 ? "bestMatch" : "EndTimeSoonest",
        });
        return (data.items || []).map((it) => {
          const normalizedCategory = normalizeCategory(it, cat);
          return {
            ...it,
            category: normalizedCategory,
            ...computeTrendingSignals(it, normalizedCategory),
          };
        });
      });
      const grouped = await Promise.all(requests);
      mixedItems = dedupeById(grouped.flat());
    } else {
      const qSeeds = CATEGORY_QUERY_MAP[selectedCategory] || [selectedCategory];
      const q = qSeeds[rotation % qSeeds.length];
      const data = await ebayService.searchItems({
        q,
        categoryId: selectedCategory,
        listingMode: "mixed",
        page,
        limit: 24,
        sortOrder: rotation % 2 === 0 ? "bestMatch" : "EndTimeSoonest",
      });
      mixedItems = dedupeById((data.items || []).map((it) => {
        const normalizedCategory = normalizeCategory(it, selectedCategory);
        return {
          ...it,
          category: normalizedCategory,
          ...computeTrendingSignals(it, normalizedCategory),
        };
      }));
    }

    const categoryBuckets = FEED_CATEGORIES.filter((c) => c.id !== "all").map((c) => ({
      _id: c.id,
      count: mixedItems.filter((it) => it.category === c.id).length,
    }));

    return {
      items: mixedItems,
      categories: categoryBuckets,
      nextCursor: page < 4 ? page + 1 : null,
    };
  } catch (error) {
    console.error('Error fetching product feed:', error);
    return {
      items: [],
      categories: [],
      nextCursor: null
    };
  }
}

export default function ProductFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionTier = getEffectiveSubscriptionTier();
  const tierLevel = subscriptionTier === "pro" || subscriptionTier === "elite" ? 2 : subscriptionTier === "core" ? 1 : 0;
  
  const [activeCategory, setActiveCategory] = useState("all");
  const [watchFeedback, setWatchFeedback] = useState({});
  const [firstDealAnimated, setFirstDealAnimated] = useState(false);
  const [feedSessionSeed, setFeedSessionSeed] = useState(() => getOrCreateSessionShuffleSeed());
  const [feedRemixKey, setFeedRemixKey] = useState(0);
  const [smartCartIds, setSmartCartIds] = useState([]);
  const [smartCartPulse, setSmartCartPulse] = useState(false);
  const [smartCartToast, setSmartCartToast] = useState("");
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery({
    queryKey: ["productFeed", activeCategory],
    queryFn: fetchFeed,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
    enabled: !!user, // Only run query if user is logged in
  });

  const { data: privateInbox } = useQuery({
    queryKey: ["private-offer-inbox"],
    queryFn: () => promotionService.getPrivateOfferInbox(),
    enabled: !!user,
    staleTime: 45 * 1000,
  });

  const watchMutation = useMutation({
    mutationFn: ({ listingId, payload }) => promotionService.watchListing(listingId, payload),
    onSuccess: (data, vars) => {
      incrementJourneyStep("/feed", "save_item", 1);
      setWatchFeedback((prev) => ({
        ...prev,
        [vars.listingId]: data?.message || "Saved. You may receive exclusive offers.",
      }));
    },
  });

  const muteMutation = useMutation({
    mutationFn: ({ listingId, muted }) => promotionService.muteListingOffers(listingId, muted),
    onSuccess: () => queryClient.invalidateQueries(["private-offer-inbox"]),
  });

  const claimMutation = useMutation({
    mutationFn: (offerId) => promotionService.claimPrivateOffer(offerId),
    onSuccess: () => queryClient.invalidateQueries(["private-offer-inbox"]),
  });

  const sentinelRef = useRef(null);
  const feedGemAssistRef = useRef(0);
  const feedIntentCoachCtxRef = useRef({});

  const onIntersect = useCallback(
    (entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(onIntersect, { rootMargin: "300px" });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [onIntersect]);

  const items = useMemo(
    () => (data?.pages ? data.pages.flatMap((p) => p.items || []) : []) || [],
    [data]
  );

  // Smart alerts: evaluate every new batch of listings. The engine's internal
  // daily cap + per-item dedupe make this safe to call on every refresh.
  const lastAlertBatchRef = useRef(0);
  useEffect(() => {
    if (!items || items.length === 0) return;
    if (items.length === lastAlertBatchRef.current) return;
    lastAlertBatchRef.current = items.length;
    try {
      reportDealsForAlerts(items);
    } catch {
      /* alerts are best-effort */
    }
  }, [items]);
  const categoryCounts = useMemo(() => {
    const merged = {};
    (data?.pages || []).forEach((p) => {
      (p.categories || []).forEach((c) => {
        const key = String(c._id || "");
        merged[key] = (merged[key] || 0) + toNum(c.count);
      });
    });
    return merged;
  }, [data]);

  const sortedItems = useMemo(() => {
    const enriched = items.map((it) => {
      const feedPrice =
        Number(it.currentPrice ?? it.price ?? it.buyNowPrice ?? it.currentBidPrice) || null;
      const baseIn = trustScoreInputFromListing(it);
      const trust = evaluateTrustScore({
        ...baseIn,
        imageUrl: (typeof it.image === "string" ? it.image : null) || baseIn.imageUrl,
        price: feedPrice ?? baseIn.price,
        seller: it.seller || it.sellerUsername || baseIn.seller,
      });
      const feedSavings =
        Number(it.marketValue) > 0 && feedPrice
          ? Math.max(0, Number(it.marketValue) - feedPrice)
          : 0;
      return {
        ...it,
        feedPrice,
        feedSavings,
        trustScore: Number(trust.trustScore) || 0,
        trustLevel: trust.trustLevel,
        aiConfidence: trust.aiConfidence,
      };
    });
    enriched.sort((a, b) => {
      const aTrend = Number(a.trendingScore ?? a.aiScore?.trendingScore ?? a.aiScore) || 0;
      const bTrend = Number(b.trendingScore ?? b.aiScore?.trendingScore ?? b.aiScore) || 0;
      const aTrust = Number(a.trustScore) || 0;
      const bTrust = Number(b.trustScore) || 0;
      const aExposure = aTrend * (0.22 + 0.78 * (aTrust / 100));
      const bExposure = bTrend * (0.22 + 0.78 * (bTrust / 100));
      return bExposure - aExposure;
    });
    return enriched;
  }, [items]);

  const smartCartItems = useMemo(
    () => smartCartIds
      .map((id) => sortedItems.find((it) => String(it.id || it.itemId || "") === id))
      .filter(Boolean),
    [smartCartIds, sortedItems]
  );

  const smartCartFocusCategory = useMemo(() => {
    if (!smartCartItems.length) return activeCategory === "all" ? "electronics" : activeCategory;
    const last = smartCartItems[smartCartItems.length - 1];
    return normalizeCategory(last, "all");
  }, [smartCartItems, activeCategory]);

  const smartCartRecommendations = useMemo(() => {
    const blueprints = SMART_CART_BLUEPRINTS[smartCartFocusCategory] || SMART_CART_BLUEPRINTS.electronics;
    const source = sortedItems.filter((it) => !smartCartIds.includes(String(it.id || it.itemId || "")));
    return blueprints.map((bp, idx) => {
      const match = source.find((it) => {
        const title = String(it.title || "").toLowerCase();
        return bp.tags.some((t) => title.includes(t));
      }) || source[idx] || null;
      const currentPrice = Number(match?.currentPrice ?? match?.price ?? match?.buyNowPrice ?? 120 + idx * 35);
      const marketPrice = Number(match?.marketValue ?? currentPrice * 1.14);
      const estimatedSavings = Math.max(0, Math.round(marketPrice - currentPrice));
      const trustScore = Math.round(Number(match?.trustScore ?? 72 + (idx % 3) * 8));
      const watchers = Number(match?.bidCount ?? match?.bids ?? idx + 1);
      return {
        id: String(match?.id || match?.itemId || `smart-${bp.key}`),
        item: match,
        title: match?.title || bp.label,
        section: bp.section,
        currentPrice,
        marketPrice,
        estimatedSavings,
        trustScore,
        watchers: Math.max(1, watchers),
        reason: `Pairs with your ${smartCartFocusCategory} build`,
      };
    });
  }, [smartCartFocusCategory, sortedItems, smartCartIds]);

  const smartSections = useMemo(() => {
    const sectionMap = {
      ai: { title: "🧠 Savvy AI Recommendations", minTier: 0 },
      bundle: { title: "🔥 Bundle & Save More", minTier: 1 },
      lowComp: { title: "⚡ Low Competition Add-ons", minTier: 1 },
      premium: { title: "💎 Premium Pairings", minTier: 2 },
      finish: { title: "🎯 Finish Your Setup", minTier: 0 },
    };
    return Object.entries(sectionMap)
      .map(([key, meta]) => ({
        key,
        ...meta,
        items: smartCartRecommendations.filter((r) => r.section === key),
      }))
      .filter((x) => x.items.length > 0 && tierLevel >= x.minTier);
  }, [smartCartRecommendations, tierLevel]);

  const setupGoalCount = smartCartFocusCategory === "gaming" ? 5 : smartCartFocusCategory === "auto" ? 4 : 4;
  const setupRemaining = Math.max(0, setupGoalCount - smartCartItems.length);
  const smartCartCoachLine = setupRemaining > 0
    ? `You are ${setupRemaining} item${setupRemaining === 1 ? "" : "s"} away from completing your ${smartCartFocusCategory} setup.`
    : `Setup complete. Savvy AI is now optimizing timing and hidden opportunities.`;

  const addToSmartCart = useCallback((it) => {
    const id = String(it?.id || it?.itemId || "");
    if (!id) return;
    setSmartCartIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSmartCartPulse(true);
    setSmartCartToast("Smart Cart updated");
    window.setTimeout(() => setSmartCartPulse(false), 850);
    window.setTimeout(() => setSmartCartToast(""), 1800);
  }, []);

  const firstDeal = sortedItems[0] || null;
  const showFirstDealSpotlight = hasCompletedFirstSixty() && Boolean(firstDeal);

  useEffect(() => {
    if (!user) return;
    incrementJourneyStep("/feed", "view_items", Math.min(3, sortedItems.length));
  }, [user, sortedItems.length]);

  const dynamicFeed = useMemo(
    () =>
      buildDynamicFeedSections(sortedItems, {
        activeCategory,
        sessionSeed: feedSessionSeed,
        remixKey: feedRemixKey,
      }),
    [sortedItems, activeCategory, feedSessionSeed, feedRemixKey]
  );

  const dynamicFeedShownKey = useMemo(() => {
    const uniq = [...new Set(dynamicFeed.flatIds)].sort();
    return uniq.join("|");
  }, [dynamicFeed]);

  useEffect(() => {
    if (sortedItems.length === 0) return;
    mergeHistoricalPoolFromSorted(sortedItems);
  }, [sortedItems]);

  useEffect(() => {
    if (!dynamicFeedShownKey) return;
    markDynamicFeedItemsShown(dynamicFeedShownKey.split("|").filter(Boolean));
  }, [dynamicFeedShownKey]);

  const feedCategoryRemixSkipRef = useRef(true);
  useEffect(() => {
    if (feedCategoryRemixSkipRef.current) {
      feedCategoryRemixSkipRef.current = false;
      return;
    }
    setFeedRemixKey((k) => k + 1);
  }, [activeCategory]);

  useEffect(() => {
    if (!user || sortedItems.length === 0) return;
    const tNow = Date.now();
    if (tNow - feedGemAssistRef.current < 34000) return;
    const top = sortedItems.find(
      (it) => Number(it.aiScore) >= 72
    );
    if (!top) return;
    feedGemAssistRef.current = tNow;
    recordSkillGem();
    const rawTitle = String(top.title || "This listing");
    const short = rawTitle.length > 40 ? `${rawTitle.slice(0, 40)}…` : rawTitle;
    pushAssistantSignal({
      id: "feed-ai-gem-pick",
      tone: "gem",
      title: "Optimize",
      body: `"${short}" — save or promote for faster Power.`,
      priority: 1,
    });
  }, [user, sortedItems]);

  if (!user) {
    return (
      <div className="feed-wrap">
        <header className="feed-header">
          <h1>Trending Feed</h1>
          <p className="muted">Discover what is trending across eBay categories in real time.</p>
        </header>
        <div className="feed-status">
          <p>Please <Link to="/login">login</Link> to view the product feed</p>
        </div>
      </div>
    );
  }

  if (status === "loading") return <div className="feed-status">Loading…</div>;
  if (status === "error") return <div className="feed-status">Error: {String(error)}</div>;

  feedIntentCoachCtxRef.current = {
    visibleItems: dynamicFeed.sections.flatMap((s) => s.items),
    watchlistIds: [],
    now: Date.now(),
    startTime: Date.now(),
  };

  return (
    <div className="feed-wrap">
      <header className="feed-header">
        <h1>Trending Across eBay</h1>
        <p className="muted">Category-diverse discovery feed with momentum, demand, and activity signals.</p>
      </header>

      {showFirstDealSpotlight && (
        <section className="card" style={{ marginBottom: 14, borderColor: "#a855f7" }}>
          <div className="row">
            <h2 className="title">First Deal Experience: Best Move Spotlight</h2>
            <span className="chip chip-score">{firstDealAnimated ? "Engaged" : "Best Move"}</span>
          </div>
          <div className="meta">
            <p className="sub">{firstDeal.title}</p>
            <div className="row">
              <span className="sub">Trust: {Math.round(Number(firstDeal.trustScore || 0))}</span>
              <span className="sub">Value: ${(firstDeal.feedSavings || 0).toFixed(0)} potential</span>
              <span className="sub">Timing: {firstDeal.endsIn || firstDeal.endsAtHuman || "Live now"}</span>
            </div>
            <p className="sub" style={{ marginTop: 6 }}>
              Both buyers and sellers earn Savvy on every deal.
            </p>
            <button
              className="btn btn-primary"
              style={{
                marginTop: 8,
                transform: firstDealAnimated ? "scale(1.04)" : "scale(1)",
                transition: "transform 160ms ease",
              }}
              onClick={() => {
                setFirstDealAnimated(true);
                incrementJourneyStep("/feed", "click_deal", 1);
                window.setTimeout(() => setFirstDealAnimated(false), 650);
              }}
            >
              Interact with Best Move
            </button>
          </div>
        </section>
      )}

      {(privateInbox?.offers || []).length > 0 && (
        <section className="card" style={{ marginBottom: 14 }}>
          <h2 className="title" style={{ marginBottom: 10 }}>Seller sent you a private offer</h2>
          <div className="meta">
            {(privateInbox?.offers || []).slice(0, 3).map((offer) => (
              <div key={offer.offerId} className="row" style={{ marginBottom: 8 }}>
                <span className="sub" style={{ fontWeight: 700 }}>
                  {offer.title || offer.listingId} - {offer.discountPercent}% off
                </span>
                <span className="sub">
                  Expires {offer.expiresAt ? new Date(offer.expiresAt).toLocaleTimeString() : "soon"}
                </span>
                {offer.status === "sent" ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => claimMutation.mutate(offer.offerId)}
                    disabled={claimMutation.isLoading}
                  >
                    Claim Offer
                  </button>
                ) : (
                  <span className="sub">{offer.status}</span>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={() => muteMutation.mutate({ listingId: offer.listingId, muted: true })}
                >
                  Mute offers
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div
        className="feed-category-chips"
        role="tablist"
        aria-label="Trending categories"
        data-tour="feed-categories"
      >
        {FEED_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          const count = cat.id === "all" ? sortedItems.length : toNum(categoryCounts[cat.id]);
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`feed-category-chip ${isActive ? "active" : ""}`}
              onClick={() => {
                setActiveCategory(cat.id);
                trackCategoryView(cat.id);
                emitTourAction("feed", { category: cat.id });
              }}
            >
              {cat.label}
              <span className="feed-category-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="dynamic-feed-toolbar">
        <p className="muted dynamic-feed-toolbar__hint">
          Mix refreshes automatically by category. Remix order for a new layout this session.
        </p>
        <button
          type="button"
          className="btn btn-ghost dynamic-feed-toolbar__btn"
          onClick={() => {
            bumpSessionShuffleSeed();
            setFeedSessionSeed(getOrCreateSessionShuffleSeed());
            setFeedRemixKey((k) => k + 1);
          }}
        >
          Remix feed
        </button>
      </div>

      <section className={`smart-cart-wrap ${smartCartPulse ? "is-pulse" : ""}`}>
        <header className="smart-cart-hd">
          <div>
            <h2>Smart Cart AI Ecosystem</h2>
            <p className="muted">Build-aware recommendations that complete setups, not random upsells.</p>
          </div>
          <div className="smart-cart-tier">
            <span>{subscriptionTier === "free" ? "FREE" : subscriptionTier === "core" ? "$7" : "$14"} Mode</span>
          </div>
        </header>

        <div className="smart-cart-coach">
          <strong>{smartCartCoachLine}</strong>
          {smartCartRecommendations.some((r) => /ssd/i.test(r.title)) ? (
            <span> Adding an SSD can activate your 2.5x bundle multiplier path.</span>
          ) : null}
        </div>

        <div className="smart-cart-state-row">
          <span>{smartCartItems.length} build items in Smart Cart</span>
          <span>Focus: {smartCartFocusCategory}</span>
          <span>{tierLevel === 0 ? "Unlock trust + low competition lanes at $7" : tierLevel === 1 ? "Unlock premium pairings at $14" : "Full AI optimization active"}</span>
        </div>

        {smartSections.map((section) => (
          <div className="smart-cart-lane" key={section.key}>
            <h3>{section.title}</h3>
            <div className="smart-cart-lane-track">
              {section.items.map((rec) => (
                <article key={`${section.key}-${rec.id}`} className="smart-cart-card">
                  {rec.item?.image ? <img src={rec.item.image} alt={rec.title} loading="lazy" /> : <div className="smart-cart-card__img-fallback">AI Pick</div>}
                  <div className="smart-cart-card__body">
                    <h4>{rec.title}</h4>
                    <div className="smart-cart-save">SAVE ${rec.estimatedSavings.toLocaleString()}</div>
                    <p>Market: ${Math.round(rec.marketPrice).toLocaleString()} · Now: ${Math.round(rec.currentPrice).toLocaleString()}</p>
                    <p>Trust: {rec.trustScore >= 80 ? "HIGH" : rec.trustScore >= 60 ? "MED" : "LOW"} · Only {rec.watchers} watcher{rec.watchers === 1 ? "" : "s"}</p>
                    <p>{rec.reason}</p>
                    <div className="smart-cart-actions">
                      <button type="button" onClick={() => addToSmartCart(rec.item || rec)}>ADD TO BUILD</button>
                      <button type="button" onClick={() => rec.item && watchMutation.mutate({
                        listingId: String(rec.item.id || rec.item.itemId || ""),
                        payload: { title: rec.item.title, image: rec.item.image, url: rec.item.url, sellerId: rec.item.sellerId || "" },
                      })}>WATCH</button>
                      <button type="button" onClick={() => trackItemClick(rec.item || { title: rec.title, id: rec.id })}>PASS</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}

        <div className="smart-cart-weekly">
          <h3>Most completed setups this week</h3>
          <div className="smart-cart-weekly-grid">
            {MOST_COMPLETED_SETUPS.map((setup) => (
              <article key={setup.id}>
                <strong>{setup.label}</strong>
                <div className="smart-cart-actions">
                  <button
                    type="button"
                    onClick={() => {
                      smartCartRecommendations.slice(0, 3).forEach((r) => {
                        if (r.item) {
                          watchMutation.mutate({
                            listingId: String(r.item.id || r.item.itemId || ""),
                            payload: { title: r.item.title, image: r.item.image, url: r.item.url, sellerId: r.item.sellerId || "" },
                          });
                        }
                      });
                    }}
                  >
                    Watch all
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      smartCartRecommendations.slice(0, 3).forEach((r) => addToSmartCart(r.item || r));
                    }}
                  >
                    Bundle save
                  </button>
                  <button type="button" onClick={() => setActiveCategory(setup.category)}>Fill missing items</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {smartCartToast ? (
          <motion.div
            className="smart-cart-toast"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
          >
            🪙 {smartCartToast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {dynamicFeed.sections.map((sec) => {
        const sectionGroups = groupByBestMove(sec.items, (it) => ({
          trustScore: it.trustScore,
          trustLevel: it.trustLevel,
          price: it.feedPrice,
          marketValue: it.marketValue,
          secondsRemaining: it.timeRemaining ?? it.secondsRemaining,
        }));
        const hasAny =
          (sectionGroups.bestMove?.length || 0) +
            (sectionGroups.worthWatching?.length || 0) +
            (sectionGroups.risky?.length || 0) >
          0;
        return (
          <section key={sec.id} className="dynamic-feed-block" aria-labelledby={`dynamic-feed-${sec.id}`}>
            <header className="dynamic-feed-block__hd">
              <h2 id={`dynamic-feed-${sec.id}`} className="dynamic-feed-block__title">
                {sec.title}
              </h2>
              <p className="dynamic-feed-block__sub muted">{sec.subtitle}</p>
            </header>
            {hasAny ? (
              <ListingSections
                groups={sectionGroups}
                gridClassName="feed-grid"
                renderItem={(entry) => {
                  const it = entry.item;
                  const idKey = itemFeedId(it);
                  const stillLook = idKey && dynamicFeed.stillWorthLookIds.has(idKey);
                  const curRaw = it.currentPrice ?? it.price;
                  const currentDisplay =
                    typeof curRaw === "number"
                      ? `$${curRaw.toLocaleString()}`
                      : curRaw != null && curRaw !== ""
                        ? `$${curRaw}`
                        : "—";
                  const savingsNum = Number(it.feedSavings);
                  const trustNum = Number(it.trustScore);
                  const trustDisplay = Number.isFinite(trustNum) ? trustNum : "—";
                  return (
                    <ListingIntentAnchor
                      key={`${sec.id}-${idKey || it.title}`}
                      item={it}
                      isSaved={false}
                      coachCtxRef={feedIntentCoachCtxRef}
                    >
                      <article className="deal-card card">
                        <div className="thumb">
                          <ListingCardImage
                            item={it}
                            alt={it.title || "Listing"}
                            aspectRatio="4 / 3"
                            borderRadius="0"
                            fallbackSrc="/placeholder.png"
                          />
                          <span className="chip">eBay • {(it.category || "electronics").toString().replace(/^\w/, (m) => m.toUpperCase())}</span>
                          {stillLook && (
                            <span className="chip chip-score" title={STILL_WORTH_LOOK_LABEL}>
                              {STILL_WORTH_LOOK_LABEL}
                            </span>
                          )}
                          {typeof it.trendingScore === "number" && (
                            <span className="chip chip-score">{it.trendingLabel || "Trending"} {Math.round(it.trendingScore)}%</span>
                          )}
                          <MoveTierBadge
                            tier={entry.tier}
                            score={entry.bestMoveScore}
                            className="chip chip-move-tier"
                          />
                        </div>

                        <div className="meta">
                          <h3 className="title" title={it.title}>{it.title}</h3>
                          <div className="row" style={{ marginTop: 4 }}>
                            <span className="end">Ends {it.endsIn || it.endsAtHuman}</span>
                            <span className="sub">Bids: {it.bids ?? it.bidCount ?? 0}</span>
                          </div>
                          <div className="row">
                            <span className="sub">Competition: {it.competition ?? "—"}</span>
                            <span className="sub trend-reason" title={it.trendingReason}>{it.trendingReason || "Trending now"}</span>
                          </div>
                          <div className="deal-price">
                            <span className="current">{currentDisplay}</span>
                            <span className={Number.isFinite(savingsNum) && savingsNum > 0 ? "savings" : "savings savings--muted"}>
                              {Number.isFinite(savingsNum) && savingsNum > 0
                                ? `Save $${savingsNum.toLocaleString()}`
                                : "Save —"}
                            </span>
                          </div>
                          <div className="trust-score">Trust: {trustDisplay}/100</div>
                          <div className="row" style={{ marginTop: 6 }}>
                            <SavvyRewardBadge
                              trustScore={it.trustScore}
                              price={it.feedPrice ?? undefined}
                              savings={it.feedSavings || undefined}
                              compact
                            />
                          </div>
                        </div>

                        <div className="deal-actions" style={{ padding: "0 14px 0" }}>
                          {it.auctionId ? (
                            <Link
                              className="best-move"
                              to={`/auctions/${it.auctionId}`}
                              onClick={() => {
                                trackItemClick(it);
                                incrementJourneyStep("/feed", "click_deal", 1);
                              }}
                            >
                              Best Move
                            </Link>
                          ) : it.url ? (
                            <a
                              className="best-move"
                              href={it.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => {
                                trackItemClick(it);
                                incrementJourneyStep("/feed", "click_deal", 1);
                              }}
                            >
                              Best Move
                            </a>
                          ) : (
                            <span className="best-move" aria-disabled="true">
                              Best Move
                            </span>
                          )}
                          <SavvyAlertButton
                            className="alert-btn"
                            label="🔔 Create Alert"
                            payload={{
                              name: `${it.title || "Listing"} • Best Move alert`,
                              keywords: [String(it.title || "").slice(0, 40)],
                              maxPrice: Number(it.currentPrice ?? it.price ?? it.buyNowPrice) || undefined,
                              minConfidence: 80,
                              persona: "buyer",
                              kind: "best_move_high_conf",
                              context: { source: "feed", listingId: String(it.id || it.itemId || "") },
                            }}
                          />
                        </div>
                        <div className="deal-card__extra-actions" style={{ padding: "0 14px 16px" }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => addToSmartCart(it)}
                          >
                            Add to Build
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => navigator.share?.({ title: it.title, url: it.url || window.location.href })
                              .catch(() => {})}
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              watchMutation.mutate({
                                listingId: String(it.id || it.itemId || ""),
                                payload: {
                                  title: it.title,
                                  image: it.image,
                                  url: it.url,
                                  sellerId: it.sellerId || "",
                                },
                              })
                            }
                            disabled={watchMutation.isLoading}
                          >
                            Like / Watch
                          </button>
                        </div>
                        {watchFeedback[String(it.id || it.itemId || "")] && (
                          <div className="row" style={{ marginTop: 8, padding: "0 14px 12px" }}>
                            <span className="sub" style={{ color: "#a7f3d0" }}>
                              {watchFeedback[String(it.id || it.itemId || "")]}
                            </span>
                          </div>
                        )}
                      </article>
                    </ListingIntentAnchor>
                  );
                }}
              />
            ) : (
              <p className="feed-status muted">Nothing in this section yet — try another category or load more.</p>
            )}
          </section>
        );
      })}
      {/* sentinel for infinite scroll */}
      <div ref={sentinelRef} />

      {isFetchingNextPage && <div className="feed-status">Loading more…</div>}
      {!hasNextPage && <div className="feed-status muted">You’re all caught up.</div>}
    </div>
  );
}

