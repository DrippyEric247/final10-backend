import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEbayListings } from '../hooks/useEbayListings';
import { emitBattlePassAction } from '../lib/battlePassActionBus';
import { trackLocalDealsSearch } from '../lib/api';
import { recordDealView } from '../lib/final10PowerEngine';
import { recordBattlePassXp } from '../lib/battlePassEngine';
import { emitPowerToast } from '../lib/final10PowerFeedback';
import { evaluateBestMove } from '../lib/bestMoveEngine';
import { evaluateTrustScore, trustScoreInputFromListing } from '../lib/trustScoreEngine';
import { scoreListing } from '../lib/listingSectionsEngine';
import GlobalSmartSearch from '../components/search/GlobalSmartSearch';
import { useSearchIntent } from '../context/SearchIntentContext';
import { filterItemsByIntent } from '../lib/smartSearch';
import { emitTourAction } from '../lib/tourGuide';
import { recordSearchSignal } from '../lib/sellerTrendEngine';
import { api } from '../lib/api';
import {
  DEV_BEST_MOVE_USAGE_RESET_EVENT,
  DEV_SUBSCRIPTION_TOOLS_EVENT,
  formatTierMultiplierLabel,
  getAdvantageTier,
  getBestMoveBoostedCap,
  getEffectiveSubscriptionTier,
  getTierForQuickSnipesBoost,
  setCurrentSubscriptionTier,
} from '../lib/tierMultiplier';
import { trackQuickSnipeAction, trackQuickSnipeSearch, trackUpgradeClicked } from '../lib/analytics';
import LoadingState from '../components/ui/states/LoadingState';
import ErrorState from '../components/ui/states/ErrorState';
import EmptyState from '../components/ui/states/EmptyState';
import QuickSnipesSavvyResults from '../components/deals/QuickSnipesSavvyResults';
import '../styles/QuickSnipesCommandCenter.css';

const BOOSTED_POWER_KEY = "f10_best_move_power_daily_v1";

/** Survives React Strict Mode remounts so `?q=` hydration does not double-consume boosts. */
let __localDealsLastInitUrlKey = null;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readPowerUsage() {
  try {
    const raw = JSON.parse(localStorage.getItem(BOOSTED_POWER_KEY) || "{}");
    if (raw.date !== todayKey()) return { date: todayKey(), used: 0 };
    return { date: todayKey(), used: Math.max(0, Number(raw.used) || 0) };
  } catch {
    return { date: todayKey(), used: 0 };
  }
}

function writePowerUsage(used) {
  try {
    localStorage.setItem(BOOSTED_POWER_KEY, JSON.stringify({ date: todayKey(), used }));
  } catch {
    /* ignore */
  }
}

/**
 * Hunt tiles: `title` + `preview` are display-only; `query` is the only string sent to search.
 * Tile launches intentionally do not set the category filter — search runs all categories.
 */
const HUNT_CATEGORIES = [
  {
    id: 'sneakers',
    title: 'Live Preview Sneakers',
    preview: 'Jordan dunk sneaker lot',
    query: 'sneakers',
    loadingLine: 'Scanning sneaker lane...',
  },
  {
    id: 'gaming',
    title: 'Live Preview Gaming',
    preview: 'rtx ps5 xbox bundle',
    query: 'gaming',
    loadingLine: 'Launching gaming hunt...',
  },
  {
    id: 'watches',
    title: 'Live Preview Watches',
    preview: 'rolex omega seiko deal',
    query: 'watches',
    loadingLine: 'Scanning watch lane...',
  },
  {
    id: 'luxury',
    title: 'Live Preview Luxury',
    preview: 'designer bag auth',
    query: 'luxury fashion',
    loadingLine: 'Opening luxury lane...',
  },
  {
    id: 'pc-builds',
    title: 'Live Preview PC Builds',
    preview: 'gpu cpu motherboard combo',
    query: 'pc parts',
    loadingLine: 'Targeting PC parts lane...',
  },
  {
    id: 'bmw-parts',
    title: 'Live Preview BMW Parts',
    preview: 'bmw m3 e60 m5 parts',
    query: 'bmw parts',
    loadingLine: 'Rolling into BMW parts...',
  },
  {
    id: 'audio',
    title: 'Live Preview Audio',
    preview: 'studio monitors audio interface',
    query: 'audio gear',
    loadingLine: 'Tuning audio hunt...',
  },
  {
    id: 'cameras',
    title: 'Live Preview Cameras',
    preview: 'sony canon fuji lens lot',
    query: 'cameras',
    loadingLine: 'Scanning camera lane...',
  },
  {
    id: 'fashion',
    title: 'Live Preview Fashion',
    preview: 'vintage jacket archive',
    query: 'fashion',
    loadingLine: 'Striking fashion lane...',
  },
  {
    id: 'collectibles',
    title: 'Live Preview Collectibles',
    preview: 'pokemon graded card lot',
    query: 'collectibles',
    loadingLine: 'Hunting collectibles...',
  },
  {
    id: 'home-tech',
    title: 'Live Preview Home Tech',
    preview: 'smart home thermostat lot',
    query: 'smart home',
    loadingLine: 'Scanning home tech...',
  },
  {
    id: 'random-finds',
    title: 'Live Preview Random Finds',
    preview: 'bulk liquidation mystery lot',
    query: 'liquidation lot',
    loadingLine: 'Sweeping random finds...',
  },
];

const WHEEL_SUGGESTIONS = [
  'Vintage Pokemon',
  'Broken PS5 repair flips',
  'E60 M5 exhausts',
  'Bulk camera lots',
  'Designer jackets',
  'Rare keyboards',
  'Audio systems',
  'Luxury watches',
];

const AI_OPPORTUNITIES = [
  'Gamers are panic-selling RTX cards tonight.',
  'Sneaker listings are weak after 11PM.',
  'BMW wheel demand is climbing this week.',
  'Rolex competition is unusually low.',
  'Camera auctions are ending with low bids.',
];

function toMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

const LocalDeals = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [mode, setMode] = useState('auction');
  const [showPass, setShowPass] = useState(false);
  const [seen, setSeen] = useState({});
  const [boostedUsed, setBoostedUsed] = useState(() => readPowerUsage().used);
  const [boostedActive, setBoostedActive] = useState(false);
  const [boostExhaustedOpen, setBoostExhaustedOpen] = useState(false);
  const [pendingBoostQuery, setPendingBoostQuery] = useState('');
  const [huntLaneLoadingMessage, setHuntLaneLoadingMessage] = useState(null);
  /** When true, avoid overwriting the hunt input (e.g. boost-exhausted modal sync). Resets on tile/wheel/URL. */
  const searchInputUserEditedRef = useRef(false);
  const [tierTick, bumpTier] = useReducer((n) => n + 1, 0);
  void tierTick;
  const { intent: smartIntent } = useSearchIntent();
  const hasSearchContext = Boolean(query || categoryId);

  const subscriptionTier = getEffectiveSubscriptionTier();
  const quickSnipesBoostTier = getTierForQuickSnipesBoost();
  const tierInfo = getAdvantageTier(subscriptionTier);
  const boostedCap = getBestMoveBoostedCap(quickSnipesBoostTier);
  const boostedRemaining = Number.isFinite(boostedCap)
    ? Math.max(0, boostedCap - boostedUsed)
    : Number.POSITIVE_INFINITY;
  const hasBoostedPower = boostedRemaining > 0;

  useEffect(() => {
    const bump = () => bumpTier();
    window.addEventListener('f10:subscription-tier-updated', bump);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    return () => {
      window.removeEventListener('f10:subscription-tier-updated', bump);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    const syncUsage = () => setBoostedUsed(readPowerUsage().used);
    window.addEventListener(DEV_BEST_MOVE_USAGE_RESET_EVENT, syncUsage);
    window.addEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, syncUsage);
    return () => {
      window.removeEventListener(DEV_BEST_MOVE_USAGE_RESET_EVENT, syncUsage);
      window.removeEventListener(DEV_SUBSCRIPTION_TOOLS_EVENT, syncUsage);
    };
  }, []);

  /** Consumes one boosted credit when capped; returns whether boosted mode is on. */
  const tryConsumeBoostedCredit = useCallback(() => {
    const tier = getTierForQuickSnipesBoost();
    const cap = getBestMoveBoostedCap(tier);
    if (!Number.isFinite(cap)) {
      setBoostedActive(true);
      return true;
    }
    const { used } = readPowerUsage();
    const remaining = Math.max(0, cap - used);
    if (remaining <= 0) {
      setBoostedActive(false);
      return false;
    }
    const nextUsed = used + 1;
    setBoostedUsed(nextUsed);
    writePowerUsage(nextUsed);
    setBoostedActive(true);
    return true;
  }, []);

  const runBoostedSearch = (raw) => {
    const q = String(raw || '').trim();
    if (!q) return;
    setHuntLaneLoadingMessage(null);
    if (tryConsumeBoostedCredit()) {
      setQuery(q);
      trackLocalDealsSearch(q);
      recordSearchSignal(q);
      trackQuickSnipeSearch({ mode: 'boosted', queryLen: q.length });
      trackQuickSnipeAction('boosted_search', { queryLen: q.length });
      emitTourAction('quickSnipes', { query: q, source: 'search_bar' });
    } else {
      if (!searchInputUserEditedRef.current) {
        setSearchInput(q);
      }
      setPendingBoostQuery(q);
      setBoostExhaustedOpen(true);
    }
  };

  const runNormalSearch = (raw) => {
    const q = String(raw || '').trim();
    if (!q) return;
    setHuntLaneLoadingMessage(null);
    setBoostedActive(false);
    setQuery(q);
    trackLocalDealsSearch(q);
    recordSearchSignal(q);
    trackQuickSnipeSearch({ mode: 'normal', queryLen: q.length });
    trackQuickSnipeAction('normal_search', { queryLen: q.length });
    emitTourAction('quickSnipes', { query: q, source: 'search_bar_normal' });
  };

  useEffect(() => {
    if (location.pathname !== '/local-deals') {
      __localDealsLastInitUrlKey = null;
      return;
    }
    const sp = new URLSearchParams(location.search || '');
    const q = (sp.get('q') || '').trim();
    if (!q) return;
    const marker = `${location.pathname}${location.search}`;
    if (__localDealsLastInitUrlKey === marker) return;
    __localDealsLastInitUrlKey = marker;

    searchInputUserEditedRef.current = false;
    setSearchInput(q);
    if (tryConsumeBoostedCredit()) {
      setQuery(q);
      trackQuickSnipeSearch({ mode: 'boosted', queryLen: q.length, source: 'url_redirect' });
      trackLocalDealsSearch(q);
      recordSearchSignal(q);
      emitTourAction('quickSnipes', { query: q, source: 'search_redirect' });
    } else {
      setPendingBoostQuery(q);
      setBoostExhaustedOpen(true);
    }
  }, [location.pathname, location.search, tryConsumeBoostedCredit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/entitlements/me');
        if (cancelled) return;
        const rawTier = String(data?.premiumTier || '').toLowerCase();
        if (!data?.isPremium) {
          setCurrentSubscriptionTier('free');
          bumpTier();
          return;
        }
        if (rawTier.includes('pro') || rawTier.includes('14')) {
          setCurrentSubscriptionTier('pro');
          bumpTier();
          return;
        }
        if (rawTier.includes('elite') || rawTier.includes('35')) {
          setCurrentSubscriptionTier('elite');
          bumpTier();
          return;
        }
        setCurrentSubscriptionTier('core');
        bumpTier();
      } catch {
        if (!cancelled) {
          setCurrentSubscriptionTier('free');
          bumpTier();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const listingMode = mode === 'best_move' ? 'mixed' : mode;
  const listings = useEbayListings({
    enabled: Boolean(query || categoryId),
    query,
    categoryId,
    listingMode,
    limit: 30,
  });

  const wasListingsLoadingRef = useRef(false);
  useEffect(() => {
    if (wasListingsLoadingRef.current && !listings.isLoading) {
      setHuntLaneLoadingMessage(null);
    }
    wasListingsLoadingRef.current = listings.isLoading;
  }, [listings.isLoading]);

  const allItems = useMemo(() => {
    const sourceItems = listings.data?.normalizedItems || [];
    return sourceItems.map((item) => {
      const baseTrustInput = trustScoreInputFromListing(item);
      const trust = evaluateTrustScore({
        ...baseTrustInput,
        imageUrl: item.imageUrl || baseTrustInput.imageUrl,
        seller: item.seller || baseTrustInput.seller,
        savvyVerifiedSeller: item.savvyVerifiedSeller ?? baseTrustInput.savvyVerifiedSeller,
      });

      const decision = evaluateBestMove({
        currentBid: item.currentBidPrice,
        buyNowPrice: item.buyNowPrice,
        marketValue: item.marketValue,
        marketConfidence: item.marketConfidence,
        trustScore: trust.trustScore,
        bidCount: item.bidCount,
        secondsRemaining: item.secondsRemaining,
        condition: item.condition,
        shippingCost: item.shippingCost,
        isAuction: item.isAuction,
        isBuyNow: item.isBuyNow,
      });

      return {
        ...item,
        source: item.source || 'ebay',
        marketValue: item.marketValue ?? item.buyNowPrice ?? item.currentBidPrice ?? item.price ?? null,
        shippingCost: item.shippingCost ?? 0,
        dealScore: decision.dealScore,
        recommendationType: decision.recommendationType,
        recommendationReason: decision.recommendationReason,
        confidenceScore: decision.confidenceScore,
        bestMoveDecision: decision,
        trustScore: trust.trustScore,
        trustLevel: trust.trustLevel,
        aiConfidence: trust.aiConfidence,
        savvyWarningHeadline: trust.savvyWarningHeadline,
        savvyVerifiedSeller: trust.savvyVerifiedSeller,
        safeToRecommend: trust.safeToRecommend,
      };
    });
  }, [listings.data?.normalizedItems]);

  const visibleItems = useMemo(() => {
    const sorted = [...allItems];
    let next;
    if (mode === 'best_move') {
      const weight = { buy_now_better: 4, auction_better: 3, wait_and_watch: 2, pass: 1 };
      sorted.sort(
        (a, b) =>
          (weight[b.recommendationType] || 0) - (weight[a.recommendationType] || 0) ||
          (Number(b.trustScore) || 0) - (Number(a.trustScore) || 0) ||
          (boostedActive
            ? ((subscriptionTier === 'pro' || subscriptionTier === 'elite' ? 22 : subscriptionTier === 'core' ? 10 : 0) + (Number(b.trustScore) || 0) / 12)
              - ((subscriptionTier === 'pro' || subscriptionTier === 'elite' ? 22 : subscriptionTier === 'core' ? 10 : 0) + (Number(a.trustScore) || 0) / 12)
            : 0) ||
          (Number(b.confidenceScore) || 0) - (Number(a.confidenceScore) || 0)
      );
      next = showPass ? sorted : sorted.filter((x) => x.recommendationType !== 'pass');
    } else {
      next = sorted;
    }
    return filterItemsByIntent(next, smartIntent, {
      title: 'title',
      tags: 'tags',
      category: 'categoryId',
      trust: 'trustScore',
      bestMove: 'recommendationType',
      price: 'buyNowPrice',
      secondsRemaining: 'secondsRemaining',
    });
  }, [allItems, boostedActive, mode, showPass, smartIntent, subscriptionTier]);

  /** Quick Snipes: rank by deal engine; #1 is the cinematic hero deal. */
  const quickSnipesHero = useMemo(() => {
    const extract = (item) => ({
      trustScore: Number(item.trustScore) || 0,
      trustLevel: item.trustLevel,
      price: item.buyNowPrice ?? item.currentBidPrice ?? item.price,
      marketValue: item.marketValue,
      secondsRemaining: item.secondsRemaining,
    });
    const ranked = [...visibleItems]
      .map((item) => scoreListing(item, extract))
      .sort((a, b) => b.bestMoveScore - a.bestMoveScore)
      .slice(0, 5);
    return ranked[0] || null;
  }, [visibleItems]);

  const onMeaningfulView = (item, action) => {
    const key = `${item.itemId}:${action}`;
    if (seen[key]) return;
    setSeen((prev) => ({ ...prev, [key]: true }));

    if (/^(hero_|lane_)/.test(String(action || ''))) {
      trackQuickSnipeAction('deal_cta', {
        interaction: String(action || ''),
        itemId: item.itemId != null ? String(item.itemId) : '',
      });
    }
    const r = recordDealView(`ebay-${item.itemId}-${action}`);
    if (r.changed) {
      recordBattlePassXp('deal_view');
      if (r.powerPop) emitPowerToast(r.powerPop);
    }

    if (item.isAuction) {
      emitBattlePassAction('auction_scanned', {
        itemId: item.itemId,
        secondsRemaining: item.secondsRemaining,
        marketplace: 'ebay',
      });
    }
    if (item.isBuyNow) {
      emitBattlePassAction('buy_now_scanned', {
        itemId: item.itemId,
        marketplace: 'ebay',
        listingMode,
      });
    }
    if (item.recommendationType) {
      emitBattlePassAction('recommended_deal_viewed', {
        itemId: item.itemId,
        marketplace: 'ebay',
        recommendationType: item.recommendationType,
        confidenceScore: item.confidenceScore,
      });
    }
  };

  const lanesRef = useRef(null);
  const [liveTick, setLiveTick] = useState(0);
  const [wheelIndex, setWheelIndex] = useState(0);
  const [activityIndex, setActivityIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setLiveTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setWheelIndex((n) => (n + 1) % WHEEL_SUGGESTIONS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  const liveActivities = useMemo(() => {
    if (!visibleItems.length) {
      return [
        'Rolex just dropped below market',
        'High-trust seller listed AirPods',
        'Savvy user completed PC build',
      ];
    }
    const top = visibleItems.slice(0, 5);
    return top.flatMap((item, idx) => {
      const title = String(item.title || 'Deal').split(' ').slice(0, 4).join(' ');
      return [
        `User ${idx + 1} saved ${toMoney((item.marketValue || 0) - (item.buyNowPrice || item.currentBidPrice || item.price || 0))} on ${title}`,
        `${Math.max(1, Number(item.bidCount) || 1)} users watching ${title}`,
      ];
    });
  }, [visibleItems]);

  useEffect(() => {
    if (!liveActivities.length) return undefined;
    const id = window.setInterval(() => {
      setActivityIndex((n) => (n + 1) % liveActivities.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [liveActivities.length]);

  const heroItem = quickSnipesHero?.item || null;
  const heroPrice = heroItem ? Number(heroItem.buyNowPrice ?? heroItem.currentBidPrice ?? heroItem.price ?? 0) : 0;
  const heroMarket = heroItem ? Number(heroItem.marketValue ?? heroPrice * 1.16) : 0;
  const heroSavings = Math.max(0, Math.round(heroMarket - heroPrice));
  const heroWatchers = Math.max(1, Number(heroItem?.bidCount || 0));
  const heroTime = Math.max(0, Number(heroItem?.secondsRemaining || 0) - liveTick);
  const heroTrust = Math.max(0, Math.round(Number(heroItem?.trustScore || 0)));

  const runHunt = (raw, source = 'hunt', opts = {}) => {
    const q = String(raw || '').trim();
    if (!q) return;
    const { ebayCategoryId, loadingMessage } = opts;
    searchInputUserEditedRef.current = false;
    setSearchInput(q);
    if (ebayCategoryId !== undefined) {
      setCategoryId(String(ebayCategoryId));
    }
    runBoostedSearch(q);
    setHuntLaneLoadingMessage(loadingMessage ?? null);
    requestAnimationFrame(() => {
      lanesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    trackQuickSnipeAction('hunt_launch', { source });
    emitTourAction('quickSnipes', { query: q, source });
  };

  return (
    <div className="min-h-screen pt-20 qscc-page">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <motion.header initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">Deal Command Center</h1>
          <p className="text-gray-300 mt-2 max-w-3xl mx-auto">
            Live AI-powered deal battlefield. One more scroll could surface your next insane snipe.
          </p>
        </motion.header>

        <div className="qscc-glass rounded-2xl p-4 sm:p-6">
          <GlobalSmartSearch scope="quick-snipes" listLoading={Boolean(hasSearchContext && listings.isLoading)} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                searchInputUserEditedRef.current = true;
                setSearchInput(e.target.value);
              }}
              onKeyDown={(e) => e.key === 'Enter' && runBoostedSearch(searchInput)}
              placeholder="Search for your next snipe..."
              className="min-w-[240px] flex-1 px-4 py-3 rounded-xl bg-slate-900/70 border border-slate-600 text-white"
            />
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-4 py-3 rounded-xl bg-slate-900/70 border border-slate-600 text-white"
            >
              <option value="">All categories</option>
              <option value="electronics">Electronics</option>
              <option value="collectibles">Collectibles</option>
              <option value="fashion">Fashion</option>
              <option value="tools">Tools</option>
            </select>
            <button
              type="button"
              onClick={() => runBoostedSearch(searchInput)}
              disabled={!searchInput.trim() || listings.isLoading}
              className={`px-5 py-3 rounded-xl font-bold ${hasBoostedPower ? 'bg-gradient-to-r from-amber-400 to-fuchsia-500 text-black' : 'bg-violet-600 text-white'}`}
            >
              {listings.isLoading ? 'Scanning...' : 'Launch Hunt'}
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-300">
            ⚡ {tierInfo.label} · Boosted opportunities left: {Number.isFinite(boostedCap) ? `${Math.max(0, boostedRemaining)} / ${boostedCap}` : 'Unlimited'} · {formatTierMultiplierLabel(subscriptionTier)} Savvy
          </div>
        </div>

        <section className="qscc-live-hero">
          {heroItem ? (
            <>
              <img src={heroItem.imageUrl} alt={heroItem.title} className="w-full h-[420px] object-cover transition-transform duration-500 hover:scale-[1.03]" />
              <div className="qscc-hero-sweep" />
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="qscc-particle" style={{ left: `${16 + i * 22}%`, top: `${18 + (i % 2) * 26}%`, animationDelay: `${i * 0.55}s` }} />
              ))}
              <div className="absolute inset-0 z-20 p-5 sm:p-7 flex flex-col justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-xs font-black tracking-[0.14em] bg-rose-600/85 border border-rose-300/30">🔥 LIVE QUICK SNIPE</span>
                  <span className="px-3 py-1 rounded-full text-xs bg-slate-900/75 border border-white/20">Trust {heroTrust >= 80 ? 'HIGH' : heroTrust >= 60 ? 'MED' : 'LOW'}</span>
                  <span className="px-3 py-1 rounded-full text-xs bg-slate-900/75 border border-white/20">Only {heroWatchers} watchers</span>
                </div>
                <div>
                  <h2 className="text-3xl sm:text-5xl font-black text-white max-w-3xl drop-shadow-2xl">{heroItem.title}</h2>
                  <p className="mt-2 text-xl sm:text-3xl font-black text-amber-300">SAVE ${heroSavings.toLocaleString()} RIGHT NOW</p>
                  <p className="mt-1 text-lg text-slate-100">Ends in {fmtTime(heroTime)}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => { onMeaningfulView(heroItem, 'hero_buy'); window.open(heroItem.itemWebUrl || heroItem.itemUrl, '_blank', 'noopener,noreferrer'); }} className="px-5 py-3 rounded-xl font-extrabold bg-gradient-to-r from-amber-300 to-orange-500 text-black">BUY NOW</button>
                    <button type="button" onClick={() => onMeaningfulView(heroItem, 'hero_watch')} className="px-5 py-3 rounded-xl font-bold border border-sky-300/50 bg-sky-500/20 text-sky-100">WATCH</button>
                    <button type="button" onClick={() => onMeaningfulView(heroItem, 'hero_pass')} className="px-5 py-3 rounded-xl font-bold border border-slate-400/40 bg-slate-900/60 text-slate-200">PASS</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-slate-300">Run a hunt to activate live hero deal.</div>
          )}
        </section>

        <section className="qscc-glass rounded-2xl p-5 sm:p-6">
          <h3 className="text-2xl font-black text-white mb-4">🎯 What are you hunting today?</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {HUNT_CATEGORIES.map((cat) => (
              <motion.button
                key={cat.id}
                type="button"
                aria-label={`${cat.title}. ${cat.preview}. Launch hunt for ${cat.query}.`}
                className="qscc-category qscc-category-launchpad rounded-2xl p-4 text-left"
                whileTap={{ scale: 0.985 }}
                onClick={() =>
                  runHunt(cat.query, 'category_bubble', {
                    ebayCategoryId: '',
                    loadingMessage: cat.loadingLine,
                  })
                }
              >
                <div className="qscc-category-title font-extrabold leading-snug">{cat.title}</div>
                <div className="qscc-category-preview text-xs mt-2 leading-relaxed">{cat.preview}</div>
                <div className="qscc-category-launch-hint">Launch hunt</div>
              </motion.button>
            ))}
          </div>
        </section>

        <section ref={lanesRef} className="space-y-4">
          {hasSearchContext ? (
            <QuickSnipesSavvyResults
              loading={Boolean(listings.isLoading)}
              items={visibleItems}
              liveTick={liveTick}
              mode={mode}
              setMode={setMode}
              showPass={showPass}
              setShowPass={setShowPass}
              runHunt={runHunt}
              onMeaningfulView={onMeaningfulView}
            />
          ) : null}
        </section>

        <section className="qscc-glass rounded-2xl p-5 sm:p-6">
          <h3 className="text-2xl font-black text-white mb-4">🧠 Savvy AI Opportunities</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {AI_OPPORTUNITIES.map((line, idx) => (
              <motion.div key={line} className="qscc-opportunity-card rounded-xl p-4 text-violet-100" animate={{ opacity: [0.88, 1, 0.88] }} transition={{ duration: 2.4, repeat: Infinity, delay: idx * 0.18 }}>
                {line}
              </motion.div>
            ))}
          </div>
        </section>

        <section className="qscc-wheel rounded-2xl p-5 sm:p-6">
          <h3 className="text-2xl font-black text-white mb-3">🎲 What if you searched...</h3>
          <AnimatePresence mode="wait">
            <motion.button
              key={WHEEL_SUGGESTIONS[wheelIndex]}
              type="button"
              onClick={() =>
                runHunt(WHEEL_SUGGESTIONS[wheelIndex], 'opportunity_wheel', { ebayCategoryId: '' })
              }
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="text-left text-lg sm:text-2xl font-black text-amber-200"
            >
              {WHEEL_SUGGESTIONS[wheelIndex]}
            </motion.button>
          </AnimatePresence>
          <p className="text-sm text-slate-200 mt-2">Tap to launch this hunt instantly.</p>
        </section>

        {!hasSearchContext && !listings.isLoading ? (
          <EmptyState
            title="Pick a hunt to start"
            description="Choose a category shortcut or type a query — we’ll scan live lanes for Quick Snipes."
            className="text-left items-stretch qscc-glass border-slate-600/40"
          />
        ) : null}
        {listings.isLoading && hasSearchContext && visibleItems.length === 0 ? (
          <LoadingState
            variant="inline"
            label={huntLaneLoadingMessage || 'Scanning live market lanes…'}
            className="text-left items-stretch qscc-glass border-slate-600/40"
          />
        ) : null}
        {listings.error ? (
          <ErrorState
            title="Market search unavailable"
            description="We couldn’t reach listings right now. Check your connection or try again."
            error={listings.error}
            onRetry={() => void listings.refetch()}
            retryLabel="Retry search"
            className="text-left items-stretch"
          />
        ) : null}
        {!listings.isLoading && !listings.error && hasSearchContext && visibleItems.length === 0 ? (
          <EmptyState
            title="No matches for this hunt"
            description="Try broader keywords, another category, or a boosted Best Move search."
            className="text-left items-stretch qscc-glass border-slate-600/40"
            action={
              <button type="button" className="f10-state__retry" onClick={() => void listings.refetch()}>
                Refresh results
              </button>
            }
          />
        ) : null}

        {boostExhaustedOpen ? (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4"
            role="presentation"
            onClick={() => setBoostExhaustedOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="boost-exhausted-title"
              className="max-w-md w-full rounded-2xl border border-amber-400/40 bg-gray-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="boost-exhausted-title" className="text-lg font-extrabold text-amber-100 mb-3">
                Boosted Best Move unavailable
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed mb-6">
                You&apos;re out of boosted Best Moves today. Continue with normal search or upgrade for more power.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-lg border border-gray-500 text-gray-100 font-semibold hover:bg-gray-800"
                  onClick={() => {
                    const q = pendingBoostQuery.trim();
                    setBoostExhaustedOpen(false);
                    setPendingBoostQuery("");
                    runNormalSearch(q);
                  }}
                >
                  Continue Normal Search
                </button>
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-purple-600 text-gray-900 font-extrabold hover:brightness-105"
                  onClick={() => {
                    setBoostExhaustedOpen(false);
                    setPendingBoostQuery("");
                    trackUpgradeClicked("quick_snipes_boost_exhausted", {
                      trigger: "boost_exhausted",
                    });
                    navigate("/premium?trigger=boost_exhausted");
                  }}
                >
                  Upgrade
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="fixed bottom-5 right-5 z-40 max-w-sm">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activityIndex}-${liveActivities[activityIndex]}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              className="rounded-xl border border-fuchsia-400/40 bg-slate-950/85 px-4 py-3 text-sm text-fuchsia-100 shadow-[0_0_24px_rgba(217,70,239,0.25)]"
            >
              🚨 {liveActivities[activityIndex]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default LocalDeals;
