import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Zap, 
  Star, 
  TrendingUp, 
  Plus,
  Eye,
  MousePointer,
  Target,
  Lightbulb,
  Megaphone,
  Coins
} from "lucide-react";
import ebayService from "../services/ebayService";
import promotionService from "../services/promotionService";
import { useAuth } from "../context/AuthContext";
import PromotedItemCard from "../components/PromotedItemCard";
import PromotionFilterTabs from "../components/PromotionFilterTabs";
import PromotionVisibilityMeter from "../components/PromotionVisibilityMeter";
import {
  estimateItemPoints,
  estimateSessionEarnings,
} from "../lib/trendingPointsEstimator";
import GlobalSmartSearch from "../components/search/GlobalSmartSearch";
import LoadingState from "../components/ui/states/LoadingState";
import ErrorState from "../components/ui/states/ErrorState";
import EmptyState from "../components/ui/states/EmptyState";
import { useSearchIntent } from "../context/SearchIntentContext";
import { filterItemsByIntent } from "../lib/smartSearch";
import { emitTourAction } from "../lib/tourGuide";
import { incrementJourneyStep } from "../lib/tabJourney";

function getVisibilityMetrics(activePromotedItems) {
  const count = Math.max(0, Number(activePromotedItems) || 0);
  const base = 100;
  const boostMultiplier = count >= 5 ? 24 : count >= 3 ? 20 : count >= 1 ? 20 : 0;
  const visibilityBoostPct = count * boostMultiplier;
  const visibilityScore = base + visibilityBoostPct;
  let visibilityLevel = "Dim";
  if (count >= 1 && count < 3) visibilityLevel = "Bright";
  else if (count >= 3 && count < 5) visibilityLevel = "Blazing";
  else if (count >= 5) visibilityLevel = "Viral";
  return { count, visibilityBoostPct, visibilityScore, visibilityLevel };
}

export default function Trending() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { intent: smartIntent } = useSearchIntent();
  
  // Fetch promoted trending feed
  const {
    data: promotedData,
    status: promotedStatus,
    error: promotedError,
    refetch: refetchPromoted,
  } = useQuery({
    queryKey: ["promoted-trending", activeTab, selectedCategory],
    queryFn: async () => {
      try {
        const feed = await promotionService.getTrendingFeed(selectedCategory, 20);
        return feed;
      } catch (error) {
        console.error('Error fetching promoted trending:', error);
        return { items: [], total: 0 };
      }
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: myPromotionsData } = useQuery({
    queryKey: ["my-promotions", user?.id],
    queryFn: () => promotionService.getMyPromotions("active"),
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Fetch organic trending as fallback
  const { data: organicData, status: organicStatus, refetch: refetchOrganic } = useQuery({
    queryKey: ["organic-trending", selectedCategory],
    queryFn: async () => {
      try {
        const trendingItems = await ebayService.getTrendingItems(selectedCategory, 20);
        return {
          trendingAuctions: trendingItems.items || [],
          trendingCategories: trendingItems.categories || []
        };
      } catch (error) {
        console.error('Error fetching organic trending:', error);
        return {
          trendingAuctions: [],
          trendingCategories: []
        };
      }
    },
    enabled: !!user && (activeTab === 'organic' || activeTab === 'all'),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Get promotion packages for quick promotion
  const { data: packages } = useQuery({
    queryKey: ["promotion-packages"],
    queryFn: () => promotionService.getPackages(),
    enabled: !!user,
  });

  // Combine data based on active tab
  const getDisplayData = () => {
    const normalizePromoted = (item) => ({
      ...item,
      promoted: true,
      promotionTier: item.promotionTier || item.tier || item.promotionType || "basic",
      promotionType: item.promotionType || item.promotionTier || item.tier || "promoted",
      visibilityScore: Number(item.visibilityScore) || Number(item.promotionMetrics?.impressions || 0),
      isPromoted: true,
    });
    const normalizeOrganic = (item) => ({
      ...item,
      promoted: false,
      promotionTier: "organic",
      visibilityScore: Number(item.visibilityScore) || Number(item.aiScore?.trendingScore || item.aiScore || 0),
      isPromoted: false,
    });

    if (activeTab === 'all') {
      const promotedItems = (promotedData?.items || []).map(normalizePromoted);
      const organicItems = (organicData?.trendingAuctions || []).map(normalizeOrganic);
      return [...promotedItems, ...organicItems].sort((a, b) => {
        if (a.promoted !== b.promoted) return a.promoted ? -1 : 1;
        return (Number(b.visibilityScore) || 0) - (Number(a.visibilityScore) || 0);
      });
    } else if (activeTab === 'organic') {
      return (organicData?.trendingAuctions || []).map(normalizeOrganic);
    } else {
      return (promotedData?.items || []).map(normalizePromoted);
    }
  };

  const displayData = filterItemsByIntent(getDisplayData(), smartIntent, {
    title: 'title',
    tags: 'tags',
    category: 'categoryId',
    trust: 'trustScore',
    bestMove: 'recommendationType',
    price: 'currentBidPrice',
    endsAt: 'endTime',
  });
  const isLoading = promotedStatus === 'loading' || organicStatus === 'loading';
  const error = promotedError || organicData?.error;

  const stats = {
    featured: displayData.filter((item) => item.isPromoted && item.promotionTier === "featured").length,
    promoted: displayData.filter((item) => item.isPromoted).length,
    totalImpressions: displayData.reduce((sum, item) => sum + (item.promotionMetrics?.impressions || 0), 0),
    totalClicks: displayData.reduce((sum, item) => sum + (item.promotionMetrics?.clicks || 0), 0),
  };
  const activePromotions = myPromotionsData?.promotions || myPromotionsData?.items || [];
  const visibility = getVisibilityMetrics(activePromotions.length);

  const earnings = useMemo(
    () =>
      estimateSessionEarnings({
        items: displayData,
        activePromotions,
        visibilityBoostPct: visibility.visibilityBoostPct,
        stats,
      }),
    [displayData, activePromotions, visibility.visibilityBoostPct, stats]
  );

  React.useEffect(() => {
    if (!user) return;
    incrementJourneyStep("/trending", "view_promoted", 1);
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                🔥 Trending - Promote Your Listings
              </h1>
              <p className="text-gray-400 text-lg">
                Discover promoted items and trending auctions. Login to see the promotion-powered feed!
              </p>
            </div>
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-8 border border-purple-500/30">
              <h2 className="text-2xl font-bold mb-4">Join the Promotion Revolution!</h2>
              <p className="text-gray-300 mb-6">
                Promote your listings and get maximum visibility. Our AI-powered promotion system 
                helps your items reach the right audience at the right time.
              </p>
              <Link 
                to="/login" 
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                <Zap className="h-5 w-5" />
                <span>Login to Get Started</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center px-4 py-16">
        <LoadingState label="Loading trending picks…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white px-4 py-16 flex justify-center">
        <ErrorState
          title="Trending feed unavailable"
          description="We couldn’t refresh promotions right now. Try again in a moment."
          error={error}
          onRetry={() => {
            void refetchPromoted();
            void refetchOrganic();
          }}
          retryLabel="Retry"
          className="max-w-md w-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <GlobalSmartSearch scope="trending" listLoading={promotedStatus === "pending" || organicStatus === "pending"} />
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            💡 Promote Visibility Lane
          </h1>
          <p className="text-gray-400 text-lg mb-6">
            Increase your visibility. Promote items to reach more buyers. Your reach grows as you promote more.
          </p>
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30 mb-6 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="lg:col-span-2">
                <PromotionVisibilityMeter count={visibility.count} />
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-purple-400/35 bg-black/25 p-3">
                  <div className="text-xs uppercase tracking-wide text-purple-300">Visibility level</div>
                  <div className="text-xl font-bold text-white">{visibility.visibilityLevel}</div>
                </div>
                <div className="rounded-lg border border-purple-400/35 bg-black/25 p-3">
                  <div className="text-xs uppercase tracking-wide text-purple-300">Visibility boost</div>
                  <div className="text-xl font-bold text-white">+{visibility.visibilityBoostPct}%</div>
                </div>
                <div className="rounded-lg border border-purple-400/35 bg-black/25 p-3">
                  <div className="text-xs uppercase tracking-wide text-purple-300">Active promoted items</div>
                  <div className="text-xl font-bold text-white">{visibility.count}</div>
                </div>
                <Link
                  to="/promote-listing"
                  data-tour="promote-cta"
                  onClick={() => {
                    emitTourAction("promote");
                    incrementJourneyStep("/trending", "open_promote_cta", 1);
                  }}
                  className="inline-flex w-full items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02]"
                >
                  <Megaphone className="h-5 w-5" />
                  <span>Promote Item</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Estimated Savvy earnings */}
          <div className="bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 rounded-xl p-5 border border-amber-400/30 mb-6 text-left">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                  <Coins className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-300 font-semibold">
                    Estimated Savvy earnings
                  </div>
                  <div className="text-2xl font-extrabold text-white tabular-nums">
                    +{earnings.total.toLocaleString()} <span className="text-amber-300 text-base">Savvy this session</span>
                  </div>
                  <div className="text-xs text-amber-100/80 mt-0.5">
                    ~{earnings.dailyProjection.toLocaleString()}/day · ~{earnings.weeklyProjection.toLocaleString()}/week at this pace
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
                <div className="rounded-lg border border-amber-400/30 bg-black/30 px-3 py-2 min-w-[120px]">
                  <div className="text-[10px] uppercase tracking-wide text-amber-300">Browse</div>
                  <div className="text-lg font-bold text-white tabular-nums">+{earnings.browseEstimate.toLocaleString()}</div>
                  <div className="text-[10px] text-amber-100/70">engage with feed</div>
                </div>
                <div className="rounded-lg border border-amber-400/30 bg-black/30 px-3 py-2 min-w-[120px]">
                  <div className="text-[10px] uppercase tracking-wide text-amber-300">Promote</div>
                  <div className="text-lg font-bold text-white tabular-nums">+{earnings.promotionEstimate.toLocaleString()}</div>
                  <div className="text-[10px] text-amber-100/70">
                    {earnings.activeCount} active · {earnings.visibilityScale}× vis
                  </div>
                </div>
                <div className="rounded-lg border border-amber-400/30 bg-black/30 px-3 py-2 min-w-[120px]">
                  <div className="text-[10px] uppercase tracking-wide text-amber-300">Realized</div>
                  <div className="text-lg font-bold text-white tabular-nums">+{earnings.realized.toLocaleString()}</div>
                  <div className="text-[10px] text-amber-100/70">from impressions &amp; clicks</div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-amber-100/60 mt-3">
              Projection only — final Savvy awards depend on actual engagement, trust tier, and verification.
            </p>
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {['all', 'electronics', 'fashion', 'home', 'automotive', 'sports'].map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  incrementJourneyStep("/trending", "switch_filter", 1);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Promotion Filter Tabs */}
        <PromotionFilterTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          stats={stats}
        />

        {/* Feed Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {displayData.length > 0 ? (
            displayData.map((item, index) => {
              const pts = estimateItemPoints(item);
              return (
                <div
                  key={`${item._id || item.id}-${index}`}
                  className="relative"
                >
                  {/* Per-item Savvy estimate — overlay chip so we don't have
                      to modify PromotedItemCard's internal markup. */}
                  <div className="absolute top-2 left-2 z-20 pointer-events-none">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-lg border backdrop-blur-sm ${
                        pts.tier === "featured"
                          ? "bg-amber-400/25 border-amber-300/60 text-amber-50"
                          : pts.tier === "boosted"
                          ? "bg-amber-500/20 border-amber-400/50 text-amber-100"
                          : item.isPromoted
                          ? "bg-purple-500/25 border-purple-300/50 text-purple-50"
                          : "bg-black/45 border-white/20 text-white/90"
                      }`}
                      title={`Base ${item.isPromoted ? "3" : "1"} + ~${pts.perClick}/click${
                        pts.featuredBonus ? ` + ${pts.featuredBonus} featured bonus` : ""
                      }`}
                    >
                      <Coins className="h-3 w-3" />
                      Est. +{pts.estimate} Savvy
                    </span>
                  </div>
                  <PromotedItemCard
                    item={item}
                    index={index}
                    isPromoted={item.isPromoted}
                  />
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-8">
              <EmptyState
                icon={<TrendingUp className="h-6 w-6" />}
                title="No listings match yet"
                description={
                  activeTab === "all"
                    ? "Nothing in featured, promoted, or organic lanes for this filter. Try another category or search."
                    : `No ${activeTab} items for this view right now.`
                }
                action={
                  <Link to="/promote-listing" className="f10-state__retry inline-flex items-center gap-2 no-underline">
                    <Plus className="h-4 w-4" />
                    Promote a listing
                  </Link>
                }
              />
            </div>
          )}
        </motion.div>

        {/* Load More Button */}
        {displayData.length >= 20 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center mt-8"
          >
            <button className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg border border-gray-600 transition-colors">
              Load More Items
            </button>
          </motion.div>
        )}

        {/* Promotion Stats Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-purple-500/30"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex items-center justify-center space-x-3">
              <Eye className="h-6 w-6 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.totalImpressions.toLocaleString()}</div>
                <div className="text-sm text-gray-400">Total Impressions</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <MousePointer className="h-6 w-6 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{stats.totalClicks}</div>
                <div className="text-sm text-gray-400">Total Clicks</div>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <Lightbulb className="h-6 w-6 text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">{displayData.filter(item => item.isPromoted).length}</div>
                <div className="text-sm text-gray-400">Promoted Items</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

