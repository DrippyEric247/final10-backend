import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { calculateRewardMultiplier } from "../lib/rewardMultiplier";
import { evaluateTrustScore, trustScoreInputFromListing } from "../lib/trustScoreEngine";
import SavvyRewardBadge from "../components/rewards/SavvyRewardBadge";
import { groupByBestMove } from "../lib/listingSectionsEngine";
import ListingSections from "../components/listings/ListingSections";
import F10SaveStarCelebration from "../components/F10SaveStarCelebration";
import { notifyUniversalProgressRefresh } from "../lib/universalBoostProgress";
import { pushAssistantSignal } from "../lib/assistantSignals";
import {
  coachBeforeSave,
  coachBeforeBidOpen,
  coachBeforeBundleBuy,
} from "../lib/dealCoach";
import ListingIntentAnchor from "../components/ListingIntentAnchor";
import { recordFinal10CloserBadge } from "../lib/customizationCatalog";
import {
  recordPowerSave,
  recordSkillLowCompetitionOnce,
  recordSkillSnipe,
} from "../lib/final10PowerEngine";
import { POWER } from "../lib/final10PowerConfig";
import { recordBattlePassXp } from "../lib/battlePassEngine";
import { triggerActionReward } from "../lib/rewardEngine";
import { emitBattlePassAction } from "../lib/battlePassActionBus";
import PlaceBidModal from "../components/ebay/PlaceBidModal";
import GlobalSmartSearch from "../components/search/GlobalSmartSearch";
import AuctionsSavvyCompareModal from "../components/auctions/AuctionsSavvyCompareModal";
import { useSearchIntent } from "../context/SearchIntentContext";
import { filterItemsByIntent } from "../lib/smartSearch";
import SavvyAlertButton from "../components/alerts/SavvyAlertButton";
import { FINAL10_DEV_OVERRIDE_EVENT } from "../lib/devOverride";
import { getAuctionPollIntervalMs, getEffectiveSubscriptionTier } from "../lib/tierMultiplier";
import { getBestListingImageUrl } from "../lib/listingImageUrl";
import EliteAuctionCard from "../components/listings/EliteAuctionCard";
import { useAuth } from "../context/AuthContext";
import { fetchEbaySearch, fetchEbayFinal10, ebayFriendlyMessage } from "../lib/ebayClient";
import { cacheKeyForAuctions, readAuctionSearchCache, writeAuctionSearchCache } from "../lib/ebaySearchCache";
import { ANALYTICS_EVENTS, trackEvent, trackUpgradeClicked } from "../lib/analytics";

const pageWrap = {
  maxWidth: "900px",
  margin: "0 auto",
  padding: "20px",
};

// Frontend simulation: adjust this object each week.
const weeklyConfig = {
  maxBundleSize: 5,
  bonusTiers: [
    { itemCount: 2, multiplier: 1.2 },
    { itemCount: 3, multiplier: 1.5 },
    { itemCount: 5, multiplier: 2 },
    { itemCount: 10, multiplier: 3 },
  ],
  expiresAt: "2026-04-10T23:59:59Z",
};

const bundleBuilderTiers = [
  { itemCount: 2, multiplier: 1.2 },
  { itemCount: 3, multiplier: 1.5 },
  { itemCount: 5, multiplier: 2 },
];

const AUCTIONS_CATEGORY_DEFAULT_QUERY = {
  gaming: "ps5",
  phones: "iphone",
  electronics: "electronics",
  fashion: "sneakers",
  home: "furniture",
  auto: "automotive",
  collectibles: "collectibles",
  tools: "tools",
  sneakers: "sneakers",
  other: "electronics",
};

const isSniperItem = (item) => {
  const t = Number(item.timeRemaining);
  const b = Number(item.bidCount);
  return Number.isFinite(t) && t <= 600 && Number.isFinite(b) && b <= 3;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toMoney = (value) => {
  const n = toNumber(value);
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

/** Savvy Trust Engine — consistent seller/listing signals for auctions + ranking. */
function evaluateAuctionListingTrust(item) {
  const base = trustScoreInputFromListing(item || {});
  return evaluateTrustScore({
    ...base,
    imageUrl: getBestListingImageUrl(item) || base.imageUrl || null,
    seller: item?.seller || item?.sellerUsername || base.seller || null,
  });
}

const computeDealScore = ({ price, marketValue, trustScore, timeRemaining, bidCount, isAuction }) => {
  const mv = toNumber(marketValue);
  const p = toNumber(price);
  const savingsPct = mv && p && mv > 0 ? Math.max(0, ((mv - p) / mv) * 100) : 0;
  const ts = toNumber(trustScore) || 0;
  let score = 34 + savingsPct * 0.26 + ts * 0.62;
  if (isAuction) {
    const t = toNumber(timeRemaining);
    const bids = toNumber(bidCount) || 0;
    if (t != null && t <= 300) score += 6;
    if (bids <= 2) score += 4;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
};

const AUCTIONS_INTENT_FIELD_MAP = {
  title: "title",
  tags: "tags",
  category: "categoryId",
  trust: "trustScore",
  bestMove: "recommendationType",
  price: "price",
  secondsRemaining: "timeRemaining",
  endsAt: "endTime",
  bidCount: "bidCount",
  marketValue: "marketValue",
  currentBid: "currentBid",
};

function extractAuctionRankSignals(item) {
  const trust = evaluateAuctionListingTrust(item);
  const displayPrice =
    toNumber(item.buyNowPrice) ?? toNumber(item.currentBid) ?? toNumber(item.price);
  return {
    trustScore: trust.trustScore,
    trustLevel: trust.trustLevel,
    price: displayPrice,
    marketValue: item.marketValue,
    secondsRemaining: item.timeRemaining,
  };
}

/** Full list → scored entries sorted by composite Best Move score (highest first). */
function rankEntriesByBestMove(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const tiered = groupByBestMove(items, extractAuctionRankSignals, {
    topLimit: 999,
    lowShareCap: 1,
  });
  return [...tiered.bestMove, ...tiered.worthWatching, ...tiered.risky].sort(
    (a, b) => b.bestMoveScore - a.bestMoveScore
  );
}

function auctionListingStableId(item) {
  if (!item) return "";
  return String(item.id ?? item.itemId ?? item.itemID ?? item.listingId ?? "").trim();
}

/** Extra guard so the Savvy #1 pick never slips into the free grid if id shapes differ. */
function auctionListingMatchesExclusive(candidate, exclusive) {
  if (!candidate || !exclusive) return false;
  const cId = auctionListingStableId(candidate);
  const eId = auctionListingStableId(exclusive);
  if (cId && eId && cId === eId) return true;
  const ct = String(candidate.title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  const et = String(exclusive.title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (et.length >= 12 && ct && ct === et) return true;
  return false;
}

function buildAuctionCompareRow(item, entry, nowMs, startMs) {
  const t = Number(item.timeRemaining);
  const elapsed = Math.floor((nowMs - startMs) / 1000);
  const secondsLeft = Number.isFinite(t) ? Math.max(0, t - elapsed) : 0;
  const trust = evaluateAuctionListingTrust(item);
  const isAuctionType = toNumber(item.buyNowPrice) == null;
  const displayPrice = isAuctionType
    ? (toNumber(item.currentBid) ?? toNumber(item.price))
    : toNumber(item.buyNowPrice);
  const marketValue = toNumber(item.marketValue) ?? (displayPrice != null ? displayPrice * 1.22 : null);
  const savings = marketValue != null && displayPrice != null ? Math.max(0, marketValue - displayPrice) : 0;
  const dealScore = computeDealScore({
    price: displayPrice,
    marketValue,
    trustScore: trust.trustScore,
    timeRemaining: secondsLeft,
    bidCount: item.bidCount,
    isAuction: isAuctionType,
  });
  return {
    item,
    trustScore: trust.trustScore,
    dealScore,
    savings,
    displayPrice,
    marketValue,
    secondsLeft,
    isAuctionType,
    tier: entry.tier,
    bestMoveScore: entry.bestMoveScore,
  };
}

const getWeekKeyUTC = (timestampMs) => {
  const d = new Date(timestampMs);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const getTaskBoost = (taskStreakWeeks) => {
  if (taskStreakWeeks >= 6) return 0.5;
  if (taskStreakWeeks >= 4) return 0.3;
  if (taskStreakWeeks >= 2) return 0.2;
  if (taskStreakWeeks >= 1) return 0.1;
  return 0;
};

export default function Auctions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const { intent: smartIntent, commitMarketSearch, marketSearchKeywords } = useSearchIntent();

  const auctionsFetchQuery = useMemo(() => {
    const k = String(marketSearchKeywords || "").trim();
    if (k) return k;
    const cat = smartIntent.categories[0];
    if (cat && AUCTIONS_CATEGORY_DEFAULT_QUERY[cat]) {
      return AUCTIONS_CATEGORY_DEFAULT_QUERY[cat];
    }
    return "ps5";
  }, [marketSearchKeywords, smartIntent.categories]);

  const [sniperItems, setSniperItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMarketPending, setSearchMarketPending] = useState(false);
  const [error, setError] = useState("");
  const [marketBanner, setMarketBanner] = useState(null);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [bidModalItem, setBidModalItem] = useState(null);
  const [bidStatus, setBidStatus] = useState(null);
  const [poppedSavedId, setPoppedSavedId] = useState(null);
  const [saveGemBurst, setSaveGemBurst] = useState(null);
  const [refreshPhase, setRefreshPhase] = useState("live");
  const [progressCollapsed, setProgressCollapsed] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now());
  const [newDealUntil, setNewDealUntil] = useState({});
  const [selectedBundleIds, setSelectedBundleIds] = useState([]);
  const [bundlePurchaseCandidates, setBundlePurchaseCandidates] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_bundle_purchase_candidates") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [savedBundles, setSavedBundles] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_saved_bundles") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const [streakData, setStreakData] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_bundle_streak_data") || "{}");
      const currentWeek = getWeekKeyUTC(Date.now());
      return {
        streak: Number(raw.streak) || 0,
        lastEvaluatedWeek: raw.lastEvaluatedWeek || currentWeek,
        completedWeeks: raw.completedWeeks && typeof raw.completedWeeks === "object" ? raw.completedWeeks : {},
      };
    } catch {
      const currentWeek = getWeekKeyUTC(Date.now());
      return { streak: 0, lastEvaluatedWeek: currentWeek, completedWeeks: {} };
    }
  });
  const [bonusExpiresAt, setBonusExpiresAt] = useState(() => {
    const raw = Number(localStorage.getItem("f10_watchlist_bonus_expires_at"));
    return Number.isFinite(raw) ? raw : 0;
  });
  const [subTier, setSubTier] = useState(() => getEffectiveSubscriptionTier());
  const [devPollTick, setDevPollTick] = useState(0);
  const [upgradeSearchOpen, setUpgradeSearchOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const compareOfferedForKeyRef = useRef(null);
  const [now, setNow] = useState(Date.now());
  const [startTime, setStartTime] = useState(Date.now());
  const [watchlistIds, setWatchlistIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("f10_watchlist_ids") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_selected_bundle_ids") || "[]");
      if (Array.isArray(raw) && raw.length) {
        setSelectedBundleIds(raw.map(String));
      }
    } catch {
      // ignore bad localStorage payload
    }
  }, []);
  const updateTimeoutRef = useRef(null);
  const fetchAuctionsRef = useRef(async () => {});
  const activeAuctionFetchRef = useRef({ id: 0, controller: null });
  const initialAuctionsLoadDoneRef = useRef(false);
  const auctionAssistThrottleRef = useRef({ urgent: 0, savedEnd: 0, gems: 0 });
  const visibleIdsRef = useRef(new Set());
  const watchlistOnlyRef = useRef(watchlistOnly);
  const watchlistIdsRef = useRef(watchlistIds);
  const intentCoachCtxRef = useRef({});
  const basePoints = Math.max(0, Math.round(Number(authUser?.savvyPoints) || 0));

  const homeQuickChips = [
    {
      label: "iPhone deals",
      apply: () => {
        commitMarketSearch("iphone deals", { categories: ["phones"] });
      },
    },
    {
      label: "PS5",
      apply: () => {
        commitMarketSearch("ps5", { categories: ["gaming"] });
      },
    },
    {
      label: "High trust",
      apply: () => {
        commitMarketSearch("high trust", { trustLevels: ["high"] });
      },
    },
    {
      label: "Ending soon",
      apply: () => {
        commitMarketSearch("ending soon", { endingSoon: true });
      },
    },
  ];

  watchlistOnlyRef.current = watchlistOnly;
  watchlistIdsRef.current = watchlistIds;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return undefined;
    const bumpPoll = () => setDevPollTick((n) => n + 1);
    window.addEventListener(FINAL10_DEV_OVERRIDE_EVENT, bumpPoll);
    return () => window.removeEventListener(FINAL10_DEV_OVERRIDE_EVENT, bumpPoll);
  }, []);

  useEffect(() => {
    const fetchItems = async (source = "effect") => {
      const isInterval = source === "interval";
      const isRetry = source === "retry";
      const needsMainLoader = !initialAuctionsLoadDoneRef.current || isRetry;
      const needsSearchLine = initialAuctionsLoadDoneRef.current && !isInterval && !isRetry;

      let signal;
      if (!isInterval) {
        activeAuctionFetchRef.current.controller?.abort();
        const ac = new AbortController();
        activeAuctionFetchRef.current.controller = ac;
        activeAuctionFetchRef.current.id += 1;
        signal = ac.signal;
      }
      const myId = activeAuctionFetchRef.current.id;

      const hasKeyword = Boolean(String(marketSearchKeywords || "").trim());
      const cat = String(smartIntent.categories[0] || "").trim();
      const ck = cacheKeyForAuctions(auctionsFetchQuery, !hasKeyword && cat ? cat : "");
      const searchParams = { q: auctionsFetchQuery, limit: 50 };
      if (!hasKeyword && cat) searchParams.categoryId = cat;

      const commitSniperResults = (sniper, raw, { banner = null, writeCache = true } = {}) => {
          if (myId !== activeAuctionFetchRef.current.id) return;
          setMarketBanner(banner);

          const modeWatchlistOnly = watchlistOnlyRef.current;
          const savedSet = new Set(watchlistIdsRef.current.map(String));
          const incomingVisible = modeWatchlistOnly
            ? sniper.filter((item) => savedSet.has(String(item.id)))
            : sniper;
          const incomingIds = new Set(incomingVisible.map((item) => String(item.id)));

          setNewDealUntil((prev) => {
            const next = {};
            const ts = Date.now();
            Object.entries(prev).forEach(([id, until]) => {
              if (until > ts) next[id] = until;
            });
            incomingIds.forEach((id) => {
              if (!visibleIdsRef.current.has(id)) {
                next[id] = ts + 4000;
              }
            });
            return next;
          });
          visibleIdsRef.current = incomingIds;

          setSniperItems(sniper);
          setStartTime(Date.now());
          setLastUpdatedAt(Date.now());
          setRefreshPhase("updated");
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = setTimeout(() => setRefreshPhase("live"), 3000);

          if (writeCache && Array.isArray(raw) && raw.length > 0) {
            writeAuctionSearchCache(ck, raw);
          }

          if (needsSearchLine) {
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent("f10:focus-auction-search"));
            });
          }
        };

      try {
        if (!isInterval) {
          setRefreshPhase("refreshing");
        }
        if (needsMainLoader) {
          setLoading(true);
        }
        if (needsSearchLine) {
          setSearchMarketPending(true);
        }
        setError("");

        let searchData = null;
        let usedDeviceCache = false;

        try {
          searchData = await fetchEbaySearch(searchParams, signal ? { signal } : {});
        } catch (searchErr) {
          if (searchErr?.name === "AbortError" || searchErr?.code === "ERR_CANCELED") throw searchErr;
          const cached = readAuctionSearchCache(ck);
          if (cached?.items?.length) {
            usedDeviceCache = true;
            const raw = cached.items;
            let sniper = raw.filter(isSniperItem);
            if (sniper.length === 0 && raw.length > 0) sniper = raw.slice(0, 30);
            commitSniperResults(sniper, raw, {
              banner: `${ebayFriendlyMessage(searchErr)} Showing saved results from this device.`,
              writeCache: false,
            });
          } else {
            throw searchErr;
          }
        }

        if (!usedDeviceCache && searchData) {
          if (myId !== activeAuctionFetchRef.current.id) return;

          let banner = null;
          if (searchData.warning) banner = searchData.warning;
          else if (searchData.mock) {
            banner =
              "Live eBay inventory is temporarily unavailable. Showing sample deals until marketplace auth is restored.";
          } else if (searchData.stale) banner = "Showing cached marketplace results.";

          let raw = searchData.items || [];
          let sniper = raw.filter(isSniperItem);

          if (sniper.length === 0) {
            try {
              const finalData = await fetchEbayFinal10({ ...searchParams, limit: 20 }, signal ? { signal } : {});
              if (myId !== activeAuctionFetchRef.current.id) return;
              if (finalData.warning && !banner) banner = finalData.warning;
              else if (finalData.stale && !banner) {
                banner = "Sniper picks may be delayed—we're showing the latest snapshot.";
              }
              if (Array.isArray(finalData.items) && finalData.items.length > 0) {
                sniper = finalData.items.filter(isSniperItem);
                if (sniper.length === 0) sniper = finalData.items;
              }
            } catch (fe) {
              if (fe?.name === "AbortError" || fe?.code === "ERR_CANCELED") throw fe;
            }
          }

          if (sniper.length === 0 && raw.length > 0) {
            sniper = raw.slice(0, 30);
          }

          if (sniper.length === 0) {
            const cached = readAuctionSearchCache(ck);
            if (cached?.items?.length) {
              raw = cached.items;
              sniper = raw.filter(isSniperItem);
              if (sniper.length === 0 && raw.length > 0) sniper = raw.slice(0, 30);
              banner = banner || "No live listings matched; showing your last saved results for this search.";
            }
          }

          if (sniper.length === 0) {
            banner = banner || "No listings matched this search yet. Try another keyword or category.";
          }

          commitSniperResults(sniper, raw, { banner, writeCache: raw.length > 0 });
        }
      } catch (err) {
        if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") return;
        const msg = ebayFriendlyMessage(err);
        const cached = readAuctionSearchCache(
          cacheKeyForAuctions(auctionsFetchQuery, !hasKeyword && cat ? cat : "")
        );
        if (cached?.items?.length) {
          let sniper = cached.items.filter(isSniperItem);
          if (sniper.length === 0 && cached.items.length > 0) sniper = cached.items.slice(0, 30);
          commitSniperResults(sniper, cached.items, {
            banner: `${msg} Showing saved results from this device.`,
            writeCache: false,
          });
          setRefreshPhase("live");
          if (needsMainLoader) {
            setLoading(false);
            initialAuctionsLoadDoneRef.current = true;
          }
          if (needsSearchLine) setSearchMarketPending(false);
          return;
        }
        if (isInterval) {
          setMarketBanner(`${msg} Still showing your last successful refresh.`);
          setRefreshPhase("live");
          return;
        }
        setMarketBanner(
          "Marketplace search is temporarily unavailable. Try again in a moment — sample deals may appear when auth is restored."
        );
        setError(null);
        setRefreshPhase("live");
      } finally {
        if (needsMainLoader) {
          setLoading(false);
          initialAuctionsLoadDoneRef.current = true;
        }
        if (needsSearchLine) {
          setSearchMarketPending(false);
        }
      }
    };

    fetchAuctionsRef.current = () => fetchItems("retry");
    fetchItems("effect");

    const refreshInterval = setInterval(() => {
      fetchItems("interval");
    }, getAuctionPollIntervalMs());

    return () => {
      // Intentionally read latest controller at unmount / deps change — not a render-time ref snapshot.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- teardown must abort the current in-flight request
      activeAuctionFetchRef.current.controller?.abort();
      clearInterval(refreshInterval);
      clearTimeout(updateTimeoutRef.current);
    };
  }, [auctionsFetchQuery, marketSearchKeywords, smartIntent.categories, devPollTick]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("f10_watchlist_ids", JSON.stringify(watchlistIds));
  }, [watchlistIds]);

  useEffect(() => {
    const onTier = () => setSubTier(getEffectiveSubscriptionTier());
    window.addEventListener("f10:subscription-tier-updated", onTier);
    window.addEventListener(FINAL10_DEV_OVERRIDE_EVENT, onTier);
    return () => {
      window.removeEventListener("f10:subscription-tier-updated", onTier);
      window.removeEventListener(FINAL10_DEV_OVERRIDE_EVENT, onTier);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("f10_saved_bundles", JSON.stringify(savedBundles));
  }, [savedBundles]);

  useEffect(() => {
    localStorage.setItem("f10_selected_bundle_ids", JSON.stringify(selectedBundleIds));
  }, [selectedBundleIds]);

  useEffect(() => {
    localStorage.setItem("f10_bundle_purchase_candidates", JSON.stringify(bundlePurchaseCandidates));
  }, [bundlePurchaseCandidates]);

  useEffect(() => {
    localStorage.setItem("f10_bundle_streak_data", JSON.stringify(streakData));
  }, [streakData]);

  useEffect(() => {
    const nowTs = Date.now();
    if (watchlistIds.length === 0) {
      setBonusExpiresAt(0);
      localStorage.removeItem("f10_watchlist_bonus_expires_at");
      return;
    }
    if (!bonusExpiresAt || bonusExpiresAt <= nowTs) {
      const expiresAt = nowTs + 10 * 60 * 1000;
      setBonusExpiresAt(expiresAt);
      localStorage.setItem("f10_watchlist_bonus_expires_at", String(expiresAt));
    }
  }, [watchlistIds, bonusExpiresAt]);

  const toggleWatchlist = (item, clickOrigin) => {
    const id = String(item.id || "");
    if (!id) return;
    const willAdd = !watchlistIds.includes(id);
    if (willAdd) {
      const coachVisible = watchlistOnly
        ? sniperItems.filter((x) => watchlistIds.includes(String(x.id)))
        : sniperItems;
      coachBeforeSave(item, {
        visibleItems: coachVisible,
        watchlistIds,
        now,
        startTime,
      });
    }
    setPoppedSavedId(id);
    setTimeout(() => setPoppedSavedId(null), 220);
    if (willAdd && clickOrigin) {
      trackEvent(ANALYTICS_EVENTS.ITEM_SAVED, {
        surface: "auctions",
        itemId: id,
      });
      const power = recordPowerSave(id);
      const bids = Number(item.bidCount);
      if (Number.isFinite(bids) && bids <= 2) {
        recordSkillLowCompetitionOnce(id);
      }
      try {
        localStorage.setItem("f10_save_gem_last", String(Date.now()));
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("f10:save-gem", { bubbles: true }));
      window.dispatchEvent(new CustomEvent("f10:ftue-action", { detail: { type: "save_item" } }));
      const labels = ["Saved ⭐", "Gem Secured 💎"];
      const praises = [
        "Good job!",
        "Nice pick!",
        "Savvy move!",
        "That's the one!",
        "Locked in!",
      ];
      const rewardPts =
        power.powerPop > 0 ? power.powerPop : POWER.DISPLAY.savePowerPop;
      setSaveGemBurst({
        x: clickOrigin.x,
        y: clickOrigin.y,
        message: labels[Math.floor(Math.random() * labels.length)],
        rewardPoints: rewardPts,
        praise: praises[Math.floor(Math.random() * praises.length)],
        powerRewardLabel: "Power",
        momentumHint: power.momentumMessage,
      });
      if (power.changed !== false) {
        recordBattlePassXp("save_item");
        triggerActionReward("save_item");
      }
    }
    setWatchlistIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    notifyUniversalProgressRefresh();
  };

  const auctionsItemPool = useMemo(
    () =>
      sniperItems.map((item) => {
        const trust = evaluateAuctionListingTrust(item);
        return {
          ...item,
          trustScore: trust.trustScore,
          trustLevel: trust.trustLevel,
          aiConfidence: trust.aiConfidence,
          savvyWarningHeadline: trust.savvyWarningHeadline,
          savvyVerifiedSeller: trust.savvyVerifiedSeller,
          safeToRecommend: trust.safeToRecommend,
        };
      }),
    [sniperItems]
  );

  const baseVisibleItems = watchlistOnly
    ? auctionsItemPool.filter((item) => watchlistIds.includes(String(item.id)))
    : auctionsItemPool;

  const auctionsSearchIntent = useMemo(() => {
    if (subTier !== "free") return smartIntent;
    return {
      ...smartIntent,
      filterHighTrust: false,
      filterLowCompetition: false,
      filterBestDealScore: false,
      trustLevels: smartIntent.trustLevels.filter((t) => t !== "high"),
    };
  }, [smartIntent, subTier]);

  /**
   * Intent-filtered listings; if filters remove everything, fall back to top 10
   * from the full scored pool so the board is never empty when data exists.
   */
  const {
    visibleItems,
    showingFullMarketFallback,
    auctionDisplayGroups,
    rankedForCompare,
  } = useMemo(() => {
    const intentFilteredItems = filterItemsByIntent(
      baseVisibleItems,
      auctionsSearchIntent,
      AUCTIONS_INTENT_FIELD_MAP
    );

    let visible;
    let showingFullMarketFallback = false;
    if (intentFilteredItems.length > 0) {
      visible = intentFilteredItems;
    } else if (auctionsItemPool.length > 0) {
      const rankedPool = rankEntriesByBestMove(auctionsItemPool);
      visible = rankedPool.slice(0, 10).map((e) => e.item);
      showingFullMarketFallback = true;
    } else {
      visible = [];
    }

    if (!visible.length) {
      return {
        visibleItems: [],
        showingFullMarketFallback,
        auctionDisplayGroups: { bestMove: [], worthWatching: [], risky: [] },
        rankedForCompare: [],
      };
    }

    const rankedResults = rankEntriesByBestMove(visible).map((e, idx) => ({
      ...e,
      item: { ...e.item, isSavvyExclusive: idx === 0 },
    }));

    const savvyBestMove = rankedResults[0] ?? null;
    const paidSeesTopPick = subTier !== "free";

    let publicAuctionResults = paidSeesTopPick ? rankedResults : rankedResults.slice(1);

    if (!paidSeesTopPick && savvyBestMove?.item) {
      publicAuctionResults = publicAuctionResults.filter(
        (e) => !auctionListingMatchesExclusive(e.item, savvyBestMove.item)
      );
    }

    const visibleItems = paidSeesTopPick
      ? rankedResults.map((e) => e.item)
      : publicAuctionResults.map((e) => e.item);

    return {
      visibleItems,
      showingFullMarketFallback,
      auctionDisplayGroups: {
        bestMove: publicAuctionResults.slice(0, 4),
        worthWatching: publicAuctionResults.slice(4, 9),
        risky: [],
      },
      rankedForCompare: rankedResults,
    };
  }, [baseVisibleItems, auctionsSearchIntent, auctionsItemPool, subTier]);

  const compareSessionKey = useMemo(() => {
    const cats = [...(smartIntent.categories || [])].sort().join(",");
    const trusts = [...(smartIntent.trustLevels || [])].sort().join(",");
    return `${auctionsFetchQuery}|${String(marketSearchKeywords || "").trim()}|${cats}|${
      smartIntent.endingSoon ? 1 : 0
    }|${trusts}`;
  }, [auctionsFetchQuery, marketSearchKeywords, smartIntent]);

  const compareModalRows = useMemo(() => {
    if (!rankedForCompare || rankedForCompare.length < 2) return null;
    const top = rankedForCompare[0];
    const second = rankedForCompare[1];
    if (String(top.item?.id) === String(second.item?.id)) return null;
    return {
      savvyRow: buildAuctionCompareRow(top.item, top, now, startTime),
      userRow: buildAuctionCompareRow(second.item, second, now, startTime),
    };
  }, [rankedForCompare, now, startTime]);

  useEffect(() => {
    compareOfferedForKeyRef.current = null;
  }, [compareSessionKey]);

  useEffect(() => {
    if (loading || error) return;
    if (sniperItems.length < 2) return;
    const qUrl = (new URLSearchParams(location.search).get("q") || "").trim();
    const hasActiveSearch = Boolean(String(marketSearchKeywords || "").trim() || qUrl);
    if (!hasActiveSearch) return;
    if (!compareModalRows) return;
    if (compareOfferedForKeyRef.current === compareSessionKey) return;
    compareOfferedForKeyRef.current = compareSessionKey;
    setCompareModalOpen(true);
  }, [
    loading,
    error,
    sniperItems.length,
    compareSessionKey,
    compareModalRows,
    marketSearchKeywords,
    location.search,
  ]);

  const onCompareModalClose = useCallback(() => {
    setCompareModalOpen(false);
  }, []);

  intentCoachCtxRef.current = {
    visibleItems,
    watchlistIds,
    now,
    startTime,
  };

  useEffect(() => {
    if (visibleItems.length === 0) return;
    const elapsed = Math.floor((now - startTime) / 1000);
    let critical = 0;
    let endingSaved = 0;
    let gemCandidates = 0;
    for (const item of visibleItems) {
      const t = Number(item.timeRemaining);
      const b = Number(item.bidCount);
      const secondsLeft = Number.isFinite(t) ? Math.max(0, t - elapsed) : 99999;
      if (secondsLeft > 0 && secondsLeft < 30) critical += 1;
      if (secondsLeft > 0 && secondsLeft <= 120 && watchlistIds.includes(String(item.id))) {
        endingSaved += 1;
      }
      if (
        secondsLeft > 0 &&
        secondsLeft <= 600 &&
        Number.isFinite(b) &&
        b <= 2 &&
        !watchlistIds.includes(String(item.id))
      ) {
        gemCandidates += 1;
      }
    }
    const th = auctionAssistThrottleRef.current;
    const tNow = Date.now();
    if (critical > 0 && tNow - th.urgent > 24000) {
      th.urgent = tNow;
      pushAssistantSignal({
        id: "auction-urgent-live",
        tone: "urgent",
        title: "Alert",
        body: `${critical} listing${critical > 1 ? "s" : ""} under 30s — bid or save now.`,
        priority: 2,
      });
    } else if (endingSaved > 0 && tNow - th.savedEnd > 36000) {
      th.savedEnd = tNow;
      pushAssistantSignal({
        id: "auction-watchlist-ending",
        tone: "watch",
        title: "Alert",
        body: `${endingSaved} saved end in 2m — open watchlist.`,
        priority: 2,
      });
    } else if (gemCandidates >= 2 && tNow - th.gems > 42000) {
      th.gems = tNow;
      pushAssistantSignal({
        id: "auction-lowbid-gems",
        tone: "gem",
        title: "Guide",
        body: "Low competition — grab this.",
        priority: 1,
      });
    }
  }, [visibleItems, now, startTime, watchlistIds]);

  const sortedWeeklyTiers = [...bundleBuilderTiers].sort((a, b) => a.itemCount - b.itemCount);
  const bundleCount = selectedBundleIds.length;
  const achievedWeeklyTier = [...sortedWeeklyTiers]
    .reverse()
    .find((tier) => bundleCount >= tier.itemCount);
  const bundleMultiplier = `${achievedWeeklyTier ? achievedWeeklyTier.multiplier : 1}x`;
  const nextBundleTier = sortedWeeklyTiers.find((tier) => bundleCount < tier.itemCount) ?? null;
  const addForNextBundleTier = nextBundleTier ? nextBundleTier.itemCount - bundleCount : 0;
  const maxWeeklyBonus = Math.max(...sortedWeeklyTiers.map((t) => t.multiplier), 1);

  const secondsSinceUpdate = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));
  const lastCheckedLabel =
    secondsSinceUpdate < 2
      ? "just now"
      : secondsSinceUpdate < 60
      ? `${secondsSinceUpdate}s ago`
      : `${Math.floor(secondsSinceUpdate / 60)}m ago`;
  const savedCount = watchlistIds.length;

  const tierLevels = [1, 3, 5, 10];
  let bonusMultiplier = "1x";
  if (savedCount >= 10) bonusMultiplier = "3x";
  else if (savedCount >= 5) bonusMultiplier = "2x";
  else if (savedCount >= 3) bonusMultiplier = "1.5x";
  else if (savedCount >= 1) bonusMultiplier = "1x";

  const nextTier = tierLevels.find((tier) => savedCount < tier) ?? null;
  const prevTier = [...tierLevels].reverse().find((tier) => savedCount >= tier) ?? 0;
  const progressPercent = nextTier
    ? Math.max(0, Math.min(100, ((savedCount - prevTier) / (nextTier - prevTier || 1)) * 100))
    : 100;
  const toNext = nextTier ? Math.max(0, nextTier - savedCount) : 0;
  const bonusSecondsLeft = Math.max(0, Math.floor((bonusExpiresAt - now) / 1000));
  const bonusMins = Math.floor(bonusSecondsLeft / 60);
  const bonusSecs = bonusSecondsLeft % 60;
  const currentWeekKey = getWeekKeyUTC(now);
  const currentWeekCompleted = Boolean(streakData.completedWeeks?.[currentWeekKey]);
  const displayStreak = streakData.streak + (currentWeekCompleted ? 1 : 0);
  const streakProgressPct = Math.max(
    0,
    Math.min(100, (bundleCount / weeklyConfig.maxBundleSize) * 100)
  );
  const streakMilestoneMessage =
    displayStreak >= 8
      ? "8-week milestone unlocked: Premium reward"
      : displayStreak >= 4
      ? "4-week milestone unlocked: Bigger reward"
      : displayStreak >= 2
      ? "2-week milestone unlocked: Bonus points"
      : "Complete your bundle to keep streak alive";
  const taskStreakWeeks = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_task_streak_data") || "{}");
      const currentWeek = getWeekKeyUTC(Date.now());
      const weekDone = Boolean(raw?.completedWeeks?.[currentWeek]);
      return (Number(raw?.streak) || 0) + (weekDone ? 1 : 0);
    } catch {
      return 0;
    }
  })();
  const taskBoost = getTaskBoost(taskStreakWeeks);
  const localMissionComplete = (() => {
    try {
      const m = JSON.parse(localStorage.getItem("f10_local_mission_data") || "{}");
      return Boolean(m.rewardReady) || (Number(m.purchases) || 0) >= 2;
    } catch {
      return false;
    }
  })();
  const promotedItems = (() => {
    try {
      const p = JSON.parse(localStorage.getItem("f10_promoted_item_ids") || "[]");
      return Array.isArray(p) ? p.length : 0;
    } catch {
      return 0;
    }
  })();
  const rewardSystem = calculateRewardMultiplier({
    bundleCount,
    watchlistCount: watchlistIds.length,
    streakWeeks: displayStreak,
    localMissionComplete,
    promotedItems,
  });
  const totalBoost = rewardSystem.totalBoost;
  const breakdown = rewardSystem.breakdown;
  const leaderboardScore = Math.floor(basePoints * totalBoost);
  const systemStates = {
    bundle: bundleCount >= 2,
    watchlist: watchlistIds.length >= 3,
    local: localMissionComplete,
    scan:
      localStorage.getItem("f10_scan_complete") === "true" ||
      localStorage.getItem("f10_video_scanner_used") === "true",
    promo: promotedItems >= 3,
    tasks: taskStreakWeeks >= 1,
  };
  const completedSystemCount = Object.values(systemStates).filter(Boolean).length;
  const nextPowerUnlockCount =
    completedSystemCount < 2 ? 2 : completedSystemCount < 3 ? 3 : completedSystemCount < 6 ? 6 : null;
  const nextPowerUnlockBoost = completedSystemCount < 2 ? "1.5x" : completedSystemCount < 3 ? "2.0x" : completedSystemCount < 6 ? "3.0x" : "MAX";
  const powerProgressPct = Math.round((completedSystemCount / 6) * 100);

  useEffect(() => {
    setStreakData((prev) => {
      if (!prev || prev.lastEvaluatedWeek === currentWeekKey) {
        return prev;
      }
      const completedLastWeek = Boolean(prev.completedWeeks?.[prev.lastEvaluatedWeek]);
      const nextStreak = completedLastWeek ? prev.streak + 1 : 0;
      return {
        ...prev,
        streak: nextStreak,
        lastEvaluatedWeek: currentWeekKey,
      };
    });
  }, [currentWeekKey]);

  useEffect(() => {
    localStorage.setItem(
      "f10_leaderboard_meta",
      JSON.stringify({
        streakWeeks: displayStreak,
        taskStreakWeeks,
        bundleBoost: breakdown.bundle - 1,
        taskBoost,
        totalBoost,
        multiplier: totalBoost,
        leaderboardScore,
        breakdown,
        updatedAt: Date.now(),
      })
    );
  }, [displayStreak, taskStreakWeeks, breakdown, taskBoost, totalBoost, leaderboardScore]);

  const markCurrentWeekCompleted = () => {
    setStreakData((prev) => ({
      ...prev,
      completedWeeks: {
        ...(prev.completedWeeks || {}),
        [getWeekKeyUTC(Date.now())]: true,
      },
    }));
  };

  const saveSelectedBundle = () => {
    if (selectedBundleIds.length === 0) return;
    const bundle = {
      id: `bundle-${Date.now()}`,
      itemIds: selectedBundleIds,
      count: selectedBundleIds.length,
      multiplier: bundleMultiplier,
      createdAt: Date.now(),
    };
    setSavedBundles((prev) => [bundle, ...prev]);
    setSelectedBundleIds([]);
    triggerActionReward("bundle_add", {
      subtitle: `${bundle.count} item${bundle.count === 1 ? "" : "s"} added to bundle`,
    });
  };

  const buySelectedBundleNow = () => {
    if (selectedBundleIds.length === 0) return;
    coachBeforeBundleBuy({
      selectedBundleIds,
      visibleItems: auctionsItemPool,
      watchlistIds,
      nextBundleTier,
      addForNextBundleTier,
      bundleMultiplier,
      weeklyMax: weeklyConfig.maxBundleSize,
    });
    if (selectedBundleIds.length >= weeklyConfig.maxBundleSize) {
      markCurrentWeekCompleted();
    }
    const selectedSet = new Set(selectedBundleIds.map(String));
    setWatchlistIds((prev) => prev.filter((id) => !selectedSet.has(String(id))));
    setSelectedBundleIds([]);
    if (selectedBundleIds.length >= weeklyConfig.maxBundleSize) {
      recordSkillSnipe();
      recordBattlePassXp("bundle_snipe");
    }
    recordFinal10CloserBadge();
    recordBattlePassXp("auction_win");
  };

  const buySavedBundleNow = (bundleId) => {
    const bundle = savedBundles.find((b) => b.id === bundleId);
    if (!bundle) return;
    const bc = (bundle.itemIds || []).length;
    const achievedSaved = [...sortedWeeklyTiers]
      .reverse()
      .find((tier) => bc >= tier.itemCount);
    const bundleMultSaved = `${achievedSaved ? achievedSaved.multiplier : 1}x`;
    const nextTierSaved = sortedWeeklyTiers.find((tier) => bc < tier.itemCount) ?? null;
    const addForSaved = nextTierSaved ? nextTierSaved.itemCount - bc : 0;
    coachBeforeBundleBuy({
      selectedBundleIds: bundle.itemIds || [],
      visibleItems: auctionsItemPool,
      watchlistIds,
      nextBundleTier: nextTierSaved,
      addForNextBundleTier: addForSaved,
      bundleMultiplier: bundleMultSaved,
      weeklyMax: weeklyConfig.maxBundleSize,
    });
    if ((bundle.itemIds || []).length >= weeklyConfig.maxBundleSize) {
      markCurrentWeekCompleted();
    }
    const bundleSet = new Set((bundle.itemIds || []).map(String));
    setWatchlistIds((prev) => prev.filter((id) => !bundleSet.has(String(id))));
    setSavedBundles((prev) => prev.filter((b) => b.id !== bundleId));
    if ((bundle.itemIds || []).length >= weeklyConfig.maxBundleSize) {
      recordSkillSnipe();
      recordBattlePassXp("bundle_snipe");
    }
    recordFinal10CloserBadge();
    recordBattlePassXp("auction_win");
  };

  const loadSavedBundleToSelection = (bundleId) => {
    const bundle = savedBundles.find((b) => b.id === bundleId);
    if (!bundle) return;
    setSelectedBundleIds((bundle.itemIds || []).map(String));
    setWatchlistOnly(true);
  };

  const markBundlePurchaseCandidate = (item) => {
    const id = String(item?.id || "");
    if (!id) return;
    setBundlePurchaseCandidates((prev) => {
      if (prev.includes(id)) return prev;
      return [id, ...prev].slice(0, 100);
    });
  };

  const handleBidPlaced = (result, item, enteredAmount, secondsRemaining) => {
    const isReal = result?.success && result?.mode === "live";
    const trustTok = result?.progression?.bidToken;
    const winTok = result?.progression?.winToken;
    if (isReal) {
      emitBattlePassAction("bid_placed", {
        auctionId: result.itemId || item.id,
        bidAmount: Number(result.bidAmount ?? result.maxAmount ?? enteredAmount),
        secondsRemaining: Number(secondsRemaining) || 0,
        marketplace: "ebay",
        ...(trustTok ? { progressionTrustToken: trustTok } : {}),
        source: "real_bid_flow",
        placedAt: result.serverTimestamp || new Date().toISOString(),
        currentBidBeforeBid: Number(item.currentBid || item.price) || undefined,
      });
      if (winTok && result.isWinning === true) {
        emitBattlePassAction("auction_won", {
          auctionId: result.itemId || item.id,
          winAmount: Number(result.bidAmount ?? result.maxAmount ?? enteredAmount),
          secondsRemaining: Number(secondsRemaining) || 0,
          marketplace: "ebay",
          progressionTrustToken: winTok,
          source: "real_bid_flow",
        });
      }
      recordBattlePassXp("bid_place");
      triggerActionReward("bid_place", { subtitle: "Bid placed" });
      setBidStatus({
        tone: "success",
        text: result.isWinning === true ? "Bid placed - you are currently winning." : "Bid placed - bid submitted.",
      });
    } else if (result?.success && result?.mode === "mock") {
      if (trustTok) {
        emitBattlePassAction("bid_placed", {
          auctionId: result.itemId || item.id,
          bidAmount: Number(result.bidAmount ?? result.maxAmount ?? enteredAmount),
          secondsRemaining: Number(secondsRemaining) || 0,
          marketplace: "ebay",
          progressionTrustToken: trustTok,
          source: "mock_bid_flow",
        });
        if (winTok && result.isWinning === true) {
          emitBattlePassAction("auction_won", {
            auctionId: result.itemId || item.id,
            winAmount: Number(result.bidAmount ?? result.maxAmount ?? enteredAmount),
            secondsRemaining: Number(secondsRemaining) || 0,
            marketplace: "ebay",
            progressionTrustToken: winTok,
            source: "mock_bid_flow",
          });
        }
        recordBattlePassXp("bid_place");
      }
      setBidStatus({
        tone: "info",
        text: "Mock bid submitted (dev mode).",
      });
    }
    setBidModalItem(null);
    setTimeout(() => setBidStatus(null), 5000);
  };

  if (loading) {
    return (
      <div style={pageWrap}>
        <div style={{ color: "#e5e5e5", fontWeight: 600 }}>Loading auctions…</div>
        <p style={{ color: "#94a3b8", marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
          Connecting to the marketplace. If it&apos;s busy, we retry automatically before showing an error.
        </p>
      </div>
    );
  }
  if (error && sniperItems.length === 0) {
    return (
      <div style={pageWrap}>
        <div
          style={{
            padding: "20px",
            borderRadius: 14,
            background: "#1a0f12",
            border: "1px solid rgba(248,113,113,0.35)",
            color: "#fecdd3",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#fff" }}>Could not load auctions</h2>
          <p style={{ marginBottom: 16 }}>{error}</p>
          <button
            type="button"
            onClick={() => {
              setError("");
              void fetchAuctionsRef.current?.();
            }}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg,#7c3aed,#a855f7)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (sniperItems.length === 0) {
    return (
      <div style={pageWrap}>
        <h1 style={{ color: "#fafafa", marginBottom: 8 }}>Final10 Auctions</h1>
        <p style={{ color: "#888", marginBottom: 16 }}>Sniper view — low competition, ending soon</p>
        {marketBanner ? (
          <div
            role="status"
            style={{
              marginBottom: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(251,191,36,0.45)",
              background: "rgba(120,53,15,0.35)",
              color: "#fef9c3",
              fontSize: 14,
              lineHeight: 1.45,
            }}
          >
            {marketBanner}
          </div>
        ) : null}
        <section
          style={{
            marginBottom: 20,
            borderRadius: 16,
            border: "1px solid rgba(250,204,21,0.45)",
            background: "linear-gradient(145deg, rgba(120,53,15,0.35), rgba(15,23,42,0.95))",
            padding: "14px 14px 12px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <GlobalSmartSearch
              scope="auctions"
              size="hero"
              hideQuickSuggestions
              placeholder="Search the full market — stays on Auctions ⚡"
              subtext="Type a query (2+ letters), then press Search or Enter to run the market search."
              auctionsMarketMode
              onLockedPremiumClick={() => setUpgradeSearchOpen(true)}
              listLoading={searchMarketPending}
            />
          </div>
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 13, color: "#fef9c3" }}>
            ⚡ Want the absolute best deal? Check{" "}
            <Link to="/local-deals" style={{ color: "#fde047", fontWeight: 800, textDecoration: "underline" }}>
              Quick Snipes
            </Link>
            .
          </p>
        </section>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", marginBottom: 8 }}>
          <span className={`live-dot ${refreshPhase}`} />
          <span>
            {searchMarketPending
              ? "Searching market…"
              : refreshPhase === "refreshing"
                ? "Refreshing deals..."
                : refreshPhase === "updated"
                  ? "Updated just now"
                  : "Live"}
          </span>
        </div>
        <div style={{ textAlign: "center", marginTop: "40px", padding: "24px", background: "#111", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ color: "#e5e5e5", marginBottom: 8 }}>Scanning for Final10 deals<span className="scan-dots">...</span></h2>
          <p style={{ color: "#888", margin: 0 }}>Last checked {lastCheckedLabel}</p>
        </div>
        {upgradeSearchOpen ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.75)",
              padding: 16,
            }}
            role="presentation"
            onClick={() => setUpgradeSearchOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="auctions-upgrade-title-empty"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 440,
                width: "100%",
                borderRadius: 16,
                border: "1px solid rgba(250,204,21,0.45)",
                background: "linear-gradient(180deg, #111827, #0b1220)",
                padding: 24,
                boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
              }}
            >
              <h2
                id="auctions-upgrade-title-empty"
                style={{ marginTop: 0, marginBottom: 12, color: "#fef3c7", fontSize: 20, fontWeight: 800 }}
              >
                Unlock smarter filters
              </h2>
              <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
                You already have the full eBay market here — unfiltered and live. Upgrade to turn on
                High Trust, Low Competition, and Best Deal Score so Final10 can rank listings the way
                Quick Snipes does.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setUpgradeSearchOpen(false)}
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
                  Not now
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUpgradeSearchOpen(false);
                    trackUpgradeClicked("auctions_search_filters_modal", {
                      trigger: "auctions_search_filters",
                    });
                    navigate("/premium?trigger=auctions_search_filters");
                  }}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg,#facc15,#a855f7)",
                    color: "#1a0f24",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  View upgrade
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <h1 style={{ color: "#fafafa", marginBottom: 8 }}>Final10 Auctions</h1>
      <p style={{ color: "#a8a8b8", marginBottom: 6, maxWidth: 640, lineHeight: 1.5 }}>
        Full eBay market access — sniper view for what&apos;s ending soon. Powerful and live; Savvy+
        adds the optimization layer (trust, competition, deal ranking).
      </p>
      {marketBanner ? (
        <div
          role="status"
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(251,191,36,0.45)",
            background: "rgba(120,53,15,0.35)",
            color: "#fef9c3",
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          {marketBanner}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(248,113,113,0.4)",
            background: "rgba(127,29,29,0.35)",
            color: "#fecdd3",
            fontSize: 14,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ flex: "1 1 220px" }}>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError("");
              void fetchAuctionsRef.current?.();
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(135deg,#7c3aed,#a855f7)",
              color: "#fff",
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      ) : null}
      <section
        style={{
          marginBottom: 20,
          borderRadius: 16,
          border: "1px solid rgba(250,204,21,0.58)",
          background:
            "linear-gradient(145deg, rgba(120,53,15,0.42), rgba(250,204,21,0.2), rgba(15,23,42,0.95))",
          boxShadow: "0 14px 34px rgba(250,204,21,0.18)",
          padding: "16px 16px 14px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.13em",
            fontSize: 11,
            color: "#fde68a",
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          Full market search
        </div>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <GlobalSmartSearch
            scope="auctions"
            size="hero"
            hideQuickSuggestions
            placeholder="Search the full market — unlock smarter filters ⚡"
            subtext="Browse everything or upgrade for high-trust, low-competition, and best deal filters."
            auctionsMarketMode
            onLockedPremiumClick={() => setUpgradeSearchOpen(true)}
            listLoading={searchMarketPending}
          />
        </div>
        <p
          style={{
            marginTop: 12,
            marginBottom: 0,
            fontSize: 14,
            color: "#fef9c3",
            lineHeight: 1.45,
          }}
        >
          ⚡ Want the absolute best deal? Check{" "}
          <Link to="/local-deals" style={{ color: "#fde047", fontWeight: 800, textDecoration: "underline" }}>
            Quick Snipes
          </Link>
          .
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 10,
            marginBottom: 4,
          }}
          aria-label="Market mode tags"
        >
          {["Raw Listing", "Unfiltered", "Full Market"].map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "5px 10px",
                borderRadius: 999,
                border: "1px solid rgba(253,224,71,0.45)",
                color: "#fffbeb",
                background: "rgba(15,23,42,0.65)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <div
          role="list"
          aria-label="Quick search suggestions"
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 8,
            marginTop: -2,
          }}
        >
          {homeQuickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              role="listitem"
              onClick={chip.apply}
              style={{
                border: "1px solid rgba(250,204,21,0.45)",
                background: "rgba(15,23,42,0.7)",
                color: "#fef3c7",
                borderRadius: 999,
                padding: "6px 12px",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>
      <div
        style={{
          background: "#0f1222",
          border: "1px solid rgba(124,131,255,0.25)",
          borderRadius: 12,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ color: "#9ca3af", fontSize: 12 }}>Total Points</div>
            <div style={{ color: "#e6e9ff", fontWeight: 800, fontSize: 20 }}>{basePoints.toLocaleString()}</div>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ color: "#9ca3af", fontSize: 12 }}>Multiplier</div>
            <div style={{ color: "#78ffd6", fontWeight: 800, fontSize: 20 }}>{totalBoost.toFixed(2)}x</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setProgressCollapsed((prev) => !prev)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "#e5e7eb",
            cursor: "pointer",
            fontWeight: 700,
            marginBottom: progressCollapsed ? 0 : 10,
          }}
        >
          View Progress {progressCollapsed ? "▾" : "▴"}
        </button>

        {!progressCollapsed && (
          <>
            <div
              style={{
                background: "linear-gradient(90deg, rgba(124,131,255,0.14) 0%, rgba(120,255,214,0.06) 100%)",
                border: "1px solid rgba(124,131,255,0.28)",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 10,
              }}
            >
              <div style={{ color: "#e6e9ff", fontWeight: 800, marginBottom: 4 }}>Sync Chain</div>
              <div style={{ color: "#b9c1f0", fontSize: 13 }}>
                {nextPowerUnlockCount
                  ? `${Math.max(0, nextPowerUnlockCount - completedSystemCount)} more system${nextPowerUnlockCount - completedSystemCount === 1 ? "" : "s"} → ${nextPowerUnlockBoost} score cap`
                  : "All systems synced — max chain."}
              </div>
              <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", marginTop: 8, overflow: "hidden" }}>
                <div style={{ width: `${powerProgressPct}%`, height: "100%", background: "linear-gradient(90deg, #7c83ff 0%, #78ffd6 100%)", transition: "width 0.25s ease" }} />
              </div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ color: "#e6e9ff", fontWeight: 700 }}>Bundle Streak: {displayStreak} week{displayStreak === 1 ? "" : "s"}</span>
                <span style={{ color: currentWeekCompleted ? "#78ffd6" : "#fbbf24", fontSize: 13 }}>
                  {currentWeekCompleted ? "Week goal completed" : `Progress ${bundleCount}/${weeklyConfig.maxBundleSize}`}
                </span>
              </div>
              <div style={{ width: "100%", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.09)", overflow: "hidden", marginBottom: 6 }}>
                <div
                  style={{
                    width: `${streakProgressPct}%`,
                    height: "100%",
                    background: currentWeekCompleted
                      ? "linear-gradient(90deg, #22c55e 0%, #78ffd6 100%)"
                      : "linear-gradient(90deg, #7c83ff 0%, #6c5cff 100%)",
                    transition: "width 0.25s ease",
                  }}
                />
              </div>
              <div style={{ color: "#b9c1f0", fontSize: 12 }}>{streakMilestoneMessage}</div>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ color: "#e5e5e5", fontWeight: 700 }}>
                  Watchlist Power: <span style={{ color: "#f5c542" }}>{savedCount}</span> saved
                </div>
                <div style={{ color: "#9ca3af", fontSize: 13 }}>
                  Bonus Multiplier: <span style={{ color: "#78ffd6", fontWeight: 700 }}>{bonusMultiplier}</span>
                </div>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #6c5cff 0%, #78ffd6 100%)",
                    transition: "width 0.35s ease",
                  }}
                />
              </div>
              <div style={{ color: "#a1a1aa", fontSize: 13 }}>
                {nextTier ? `Add ${toNext} more item${toNext === 1 ? "" : "s"} to unlock next bonus` : "Max tier unlocked: 3x points"}
                {savedCount > 0 && bonusSecondsLeft > 0 && (
                  <span style={{ marginLeft: 10, color: "#8ab4ff" }}>
                    Bonus expires in {bonusMins}:{bonusSecs.toString().padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ca3af", marginBottom: 12 }}>
        <span className={`live-dot ${refreshPhase}`} />
        <span>
          {searchMarketPending
            ? "Searching market…"
            : refreshPhase === "refreshing"
              ? "Refreshing deals..."
              : refreshPhase === "updated"
                ? "Updated just now"
                : "Live"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => setWatchlistOnly(false)}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: !watchlistOnly ? "#6c5cff" : "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          All Deals
        </button>
        <button
          onClick={() => setWatchlistOnly(true)}
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: watchlistOnly ? "#6c5cff" : "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Watchlist{" "}
          <span
            style={{
              marginLeft: 6,
              padding: "2px 8px",
              borderRadius: 999,
              background: watchlistOnly ? "#ffffff22" : "#6c5cff",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.4,
              display: "inline-block",
              minWidth: 20,
              textAlign: "center",
            }}
          >
            {watchlistIds.length}
          </span>
        </button>
        <SavvyAlertButton
          label="Alert me when it's right"
          payload={{
            name: `Auction sniper alert • ${watchlistOnly ? "watchlist" : "all deals"}`,
            keywords: [],
            minConfidence: 75,
            persona: "buyer",
            kind: "ending_soon",
            context: { source: "auctions", watchlistOnly },
          }}
          className="inline-block"
        />
      </div>

      {watchlistOnly && (
        <div
          style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 14,
          }}
        >
          <div style={{ color: "#f3f4f6", fontWeight: 700, marginBottom: 8 }}>
            Bundle Builder
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ color: "#f3f4f6", fontWeight: 700 }}>
              {bundleCount} selected
            </div>
            <div style={{ color: "#9ca3af", fontSize: 13 }}>
              Reward Multiplier: <span style={{ color: "#78ffd6", fontWeight: 700 }}>{bundleMultiplier}</span>
            </div>
          </div>
          <div
            style={{
              width: "100%",
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, nextBundleTier ? (bundleCount / nextBundleTier.itemCount) * 100 : 100)
                )}%`,
                height: "100%",
                background: "linear-gradient(90deg, #6c5cff 0%, #78ffd6 100%)",
                transition: "width 0.35s ease",
              }}
            />
          </div>
          <div style={{ color: "#a1a1aa", fontSize: 13, marginBottom: 10 }}>
            {nextBundleTier
              ? `Add ${addForNextBundleTier} more item${addForNextBundleTier === 1 ? "" : "s"} to increase reward`
              : `Max bundle bonus unlocked: ${maxWeeklyBonus}x`}
          </div>
          {bundleCount >= weeklyConfig.maxBundleSize && (
            <div style={{ color: "#fca5a5", fontSize: 12, marginBottom: 8 }}>
              Weekly limit reached: max {weeklyConfig.maxBundleSize} items per bundle.
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              onClick={buySelectedBundleNow}
              disabled={bundleCount === 0}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: bundleCount === 0 ? "#2a2a2a" : "#22c55e",
                color: "#fff",
                cursor: bundleCount === 0 ? "not-allowed" : "pointer",
              }}
            >
              Buy selected bundle now
            </button>
            <button
              onClick={saveSelectedBundle}
              disabled={bundleCount === 0}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: bundleCount === 0 ? "#2a2a2a" : "#6c5cff",
                color: "#fff",
                cursor: bundleCount === 0 ? "not-allowed" : "pointer",
              }}
            >
              Save selected bundle for later
            </button>
          </div>
        </div>
      )}

      {watchlistOnly && savedBundles.length > 0 && (
        <div
          style={{
            background: "#111",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          <h3 style={{ color: "#f3f4f6", margin: "0 0 10px 0" }}>Saved Bundles</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {savedBundles.map((bundle) => (
              <div
                key={bundle.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "#151515",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ color: "#d4d4d8", fontSize: 13 }}>
                  {bundle.count} items • {bundle.multiplier} points
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => loadSavedBundleToSelection(bundle.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "transparent",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Load bundle
                  </button>
                  <button
                    onClick={() => buySavedBundleNow(bundle.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "#22c55e",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Buy now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {visibleItems.length === 0 && watchlistOnly && (
        <div style={{ textAlign: "center", marginTop: "20px", marginBottom: "20px" }}>
          <h3 style={{ color: "#e5e5e5", marginBottom: 6 }}>No saved deals yet</h3>
          <p style={{ color: "#888", margin: 0 }}>Tap ⭐ Save on any card to add it here.</p>
        </div>
      )}

      {showingFullMarketFallback && visibleItems.length > 0 ? (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid rgba(251,191,36,0.35)",
            background: "linear-gradient(90deg, rgba(120,53,15,0.35), rgba(15,23,42,0.9))",
            color: "#fef3c7",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          No strong picks found — showing full market results
        </div>
      ) : null}

      <ListingSections
        groups={auctionDisplayGroups}
        sectionKeys={["bestMove", "worthWatching"]}
        sectionMetaOverride={{
          bestMove: {
            title: "Strong Picks",
            subtitle: "Next-best scored listings on this board — still sharp, still actionable.",
          },
          worthWatching: {
            title: "Recommended Listings",
            subtitle: "More matches from this search worth scanning before you move.",
          },
        }}
        emptyState={
          <div style={{ textAlign: "center", color: "#a8a8b8", margin: "24px 0" }}>
            <p
              style={{
                margin: 0,
                maxWidth: 520,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.55,
              }}
            >
              When at least two listings match your search, Strong Picks appear here. The single top
              snipe line stays in{" "}
              <Link to="/local-deals" style={{ color: "#fde047", fontWeight: 700 }}>
                Quick Snipes
              </Link>
              .
            </p>
          </div>
        }
        renderItem={(entry, idx) => {
          const item = entry.item;
          const t = Number(item.timeRemaining);
          const elapsed = Math.floor((now - startTime) / 1000);
          const secondsLeft = Number.isFinite(t) ? Math.max(0, t - elapsed) : 0;
          const mins = Math.floor(secondsLeft / 60);
          const secs = secondsLeft % 60;
          const timeDisplay = `${mins}:${secs.toString().padStart(2, "0")}`;
          const isUrgent = secondsLeft <= 60;
          const isCritical = secondsLeft < 30;
          const isSaved = watchlistIds.includes(String(item.id));
          const isNew = (newDealUntil[String(item.id)] || 0) > now;
          const trust = evaluateAuctionListingTrust(item);
          const isAuctionType = toNumber(item.buyNowPrice) == null;
          const displayPrice = isAuctionType
            ? (toNumber(item.currentBid) ?? toNumber(item.price))
            : toNumber(item.buyNowPrice);
          const marketValue = toNumber(item.marketValue) ?? (displayPrice != null ? displayPrice * 1.22 : null);
          const savings = marketValue != null && displayPrice != null ? Math.max(0, marketValue - displayPrice) : 0;
          const dealScore = computeDealScore({
            price: displayPrice,
            marketValue,
            trustScore: trust.trustScore,
            timeRemaining: secondsLeft,
            bidCount: item.bidCount,
            isAuction: isAuctionType,
          });
          const cardState = isCritical ? "critical" : isUrgent ? "urgent" : "normal";
          const savingsChipText = `SAVE ${toMoney(savings)}`;
          const savingsSubline = `Save ${toMoney(savings)}`;
          const urgencyLabel = isAuctionType ? `Ends in ${timeDisplay}` : "Buy it now";
          return (
            <ListingIntentAnchor
              key={item.id}
              item={item}
              isSaved={isSaved}
              coachCtxRef={intentCoachCtxRef}
            >
              <EliteAuctionCard
                  className="auction-card-hover"
                  item={item}
                  title={item.title}
                  dealScore={dealScore}
                  savingsChipText={savingsChipText}
                  priceDisplay={toMoney(displayPrice)}
                  savingsSubline={savingsSubline}
                  trustScore={trust.trustScore}
                  trustResult={trust}
                  tier={entry.tier}
                  bidCount={item.bidCount}
                  isAuction={isAuctionType}
                  savingsAmount={savings}
                  displayPriceNum={displayPrice}
                  marketValueNum={marketValue}
                  urgencyLabel={urgencyLabel}
                  cardState={cardState}
                  isNew={isNew}
                  showSavvyUnlocked={Boolean(item.isSavvyExclusive && subTier !== "free")}
                  showQuickSnipesPremiumHook={subTier === "free"}
                  onQuickSnipesPremiumClick={() => {
                    trackUpgradeClicked("elite_auction_card_quick_snipes", {
                      trigger: "elite_card_quick_snipes",
                    });
                    navigate("/premium?trigger=elite_card_quick_snipes");
                  }}
                  isSaved={isSaved}
                  poppedSaved={poppedSavedId === String(item.id)}
                  onSave={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    toggleWatchlist(item, {
                      x: r.left + r.width / 2,
                      y: r.top + r.height / 2,
                    });
                  }}
                  onBidNow={() => setBidModalItem(item)}
                  showBidButton={toNumber(item.buyNowPrice) == null}
                  alertPayload={{
                    name: `${item.title || "Auction"} • price watch`,
                    keywords: [String(item.title || "").slice(0, 40)],
                    maxPrice: Number(item.currentBid || item.price) || undefined,
                    minConfidence: 70,
                    persona: "buyer",
                    kind: "price_drop",
                    context: { source: "auction_card", listingId: String(item.id || "") },
                  }}
                  ebayHref={item.itemUrl}
                  onOpenEbay={() => {
                    coachBeforeBidOpen(item, {
                      visibleItems,
                      now,
                      startTime,
                    });
                    const next = Number(localStorage.getItem("f10_deal_click_count") || 0) + 1;
                    localStorage.setItem("f10_deal_click_count", String(next));
                    markBundlePurchaseCandidate(item);
                  }}
                  saveDataFtue={idx === 0}
                  childrenFooter={
                    <SavvyRewardBadge
                      trustScore={trust.trustScore}
                      price={displayPrice}
                      savings={savings}
                      compact
                    />
                  }
                />
            </ListingIntentAnchor>
          );
        }}
      />
      <style>{`
        @keyframes final10Flash {
          0%, 100% { opacity: 1; text-shadow: 0 0 0 rgba(255,68,68,0); }
          50% { opacity: 0.45; text-shadow: 0 0 12px rgba(255,68,68,0.9); }
        }
        @keyframes final10Critical {
          0%, 100% { transform: translateX(0); opacity: 1; text-shadow: 0 0 8px rgba(255,68,68,0.45); }
          25% { transform: translateX(-1px); }
          75% { transform: translateX(1px); opacity: 0.7; text-shadow: 0 0 16px rgba(255,68,68,0.95); }
        }
        @keyframes newDealGlow {
          0%, 100% { box-shadow: 0 0 10px rgba(0,255,100,0.1); }
          50% { box-shadow: 0 0 20px rgba(120,255,214,0.45); }
        }
        @keyframes livePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.55; }
        }
        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #22c55e;
          display: inline-block;
          box-shadow: 0 0 8px rgba(34,197,94,0.6);
        }
        .live-dot.refreshing {
          background: #7c83ff;
          box-shadow: 0 0 10px rgba(124,131,255,0.7);
          animation: livePulse 1s ease-in-out infinite;
        }
        .live-dot.updated {
          background: #22c55e;
          box-shadow: 0 0 10px rgba(34,197,94,0.8);
        }
        .scan-dots {
          animation: livePulse 1.2s ease-in-out infinite;
          display: inline-block;
          width: 18px;
          text-align: left;
        }
        @media (hover: hover) and (pointer: fine) {
          .auction-card-hover {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .auction-card-hover:hover {
            transform: translateY(-3px);
            box-shadow: 0 0 18px rgba(0,255,100,0.18);
          }
        }
      `}</style>
      {saveGemBurst ? (
        <F10SaveStarCelebration
          origin={{ x: saveGemBurst.x, y: saveGemBurst.y }}
          message={saveGemBurst.message}
          rewardPoints={saveGemBurst.rewardPoints}
          praise={saveGemBurst.praise}
          powerRewardLabel={saveGemBurst.powerRewardLabel || "Power"}
          momentumHint={saveGemBurst.momentumHint}
          onComplete={() => setSaveGemBurst(null)}
        />
      ) : null}
      {bidStatus ? (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            background: bidStatus.tone === "success" ? "#14532d" : "#1e3a8a",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            borderRadius: 10,
            padding: "10px 12px",
            zIndex: 60,
            maxWidth: 320,
          }}
        >
          {bidStatus.text}
        </div>
      ) : null}
      <AuctionsSavvyCompareModal
        open={compareModalOpen && Boolean(compareModalRows)}
        onClose={onCompareModalClose}
        userRow={compareModalRows?.userRow}
        savvyRow={compareModalRows?.savvyRow}
        subTier={subTier}
      />
      <PlaceBidModal
        open={Boolean(bidModalItem)}
        item={bidModalItem}
        onClose={() => setBidModalItem(null)}
        onBidPlaced={handleBidPlaced}
      />
      {upgradeSearchOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            padding: 16,
          }}
          role="presentation"
          onClick={() => setUpgradeSearchOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auctions-upgrade-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              width: "100%",
              borderRadius: 16,
              border: "1px solid rgba(250,204,21,0.45)",
              background: "linear-gradient(180deg, #111827, #0b1220)",
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.55)",
            }}
          >
            <h2
              id="auctions-upgrade-title"
              style={{ marginTop: 0, marginBottom: 12, color: "#fef3c7", fontSize: 20, fontWeight: 800 }}
            >
              Unlock smarter filters
            </h2>
            <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.55, marginBottom: 22 }}>
              You already have the full eBay market here — unfiltered and live. Upgrade to turn on
              High Trust, Low Competition, and Best Deal Score so Final10 can rank listings the way
              Quick Snipes does.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setUpgradeSearchOpen(false)}
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
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  setUpgradeSearchOpen(false);
                  trackUpgradeClicked("auctions_search_filters_modal", {
                    trigger: "auctions_search_filters",
                  });
                  navigate("/premium?trigger=auctions_search_filters");
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "linear-gradient(135deg,#facc15,#a855f7)",
                  color: "#1a0f24",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                View upgrade
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
