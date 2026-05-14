import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import OfferCard from "../components/offers/OfferCard";
import { savvyOffersMock } from "../data/savvyOffersMock";
import { couponBusinesses, savvyCouponsMock } from "../data/savvyCouponsMock";
import { calculateRewardPoints, calculateSavings, dedupeOffers, rankOffers } from "../lib/offerEngine";
import offersService from "../services/offersService";
import businessOffersService from "../services/businessOffersService";
import {
  recordCouponRedemption,
  recordPartnerPurchase,
} from "../lib/customizationCatalog";
import {
  SAVVY_PROGRAM_UPDATE_EVENT,
  USER_TYPES,
  canClaimOffer,
  computeOfferReward,
  getEnrollment,
  prioritizeOffersForProgram,
  recordClaim,
  trackProgramEvent,
} from "../lib/savvyPrograms";
import "../styles/SavvyPrograms.css";
import GlobalSmartSearch from "../components/search/GlobalSmartSearch";
import { useSearchIntent } from "../context/SearchIntentContext";
import { filterItemsByIntent } from "../lib/smartSearch";
import { emitTourAction } from "../lib/tourGuide";
import SavvyAlertButton from "../components/alerts/SavvyAlertButton";
import LoadingState from "../components/ui/states/LoadingState";
import ErrorState from "../components/ui/states/ErrorState";
import EmptyState from "../components/ui/states/EmptyState";
import { ANALYTICS_EVENTS, trackEvent } from "../lib/analytics";

const OFFER_CATEGORIES = ["all", "electronics", "gaming", "sneakers", "fashion", "home", "auto"];

function getUserRegionHint() {
  try {
    return localStorage.getItem("f10_user_region") || "Dallas, TX";
  } catch {
    return "Dallas, TX";
  }
}

function mapSourceType(rawTier) {
  if (rawTier === "featured") return "featured";
  if (rawTier === "boosted") return "promoted";
  return "marketplace";
}

async function fetchOffers() {
  const now = Date.now();
  const businessMap = couponBusinesses.reduce((acc, b) => {
    acc[b.id] = b;
    return acc;
  }, {});

  const marketplace = savvyOffersMock.map((o) => {
    const price = Number(o.price || 0);
    const marketValue = Number(o.marketValue || (price * 1.25));
    const { savings, savingsPct } = calculateSavings(price, marketValue);
    return {
      id: String(o.id),
      title: o.offerTitle,
      image: o.image || o.business?.logo || "https://via.placeholder.com/640x480/111827/A78BFA?text=Deal",
      price,
      marketValue,
      savings,
      savingsPct,
      sourceType: mapSourceType(o.promotionTier),
      category: o.category || "electronics",
      trustScore: Number(o.business?.trustScore || 75),
      demandLevel: o.demandLevel || "medium",
      expiresAt: Number(o.expiresAt || now + 12 * 60 * 60 * 1000),
      rewardPoints: 0,
      sellerId: String(o.business?.id || "seller-mkt"),
      isPromoted: o.promotionTier !== "basic",
      promotionTier: o.promotionTier || "basic",
      url: o.url || "https://www.ebay.com",
      popularity: Number(o.popularity || 300),
      location: o.business?.location || "Online",
      saved: false,
    };
  });

  const couponOffers = savvyCouponsMock.map((coupon) => {
    const biz = businessMap[coupon.businessId];
    const pseudoPrice = Math.max(5, Math.round(coupon.savingsValue * 2.2));
    const pseudoMarket = pseudoPrice + coupon.savingsValue;
    const { savings, savingsPct } = calculateSavings(pseudoPrice, pseudoMarket);
    const category = coupon.category === "retail" ? "fashion" : coupon.category === "services" ? "auto" : coupon.category;
    return {
      id: `coupon-${coupon.id}`,
      title: `${coupon.offerText} • ${biz?.name || "Offer"}`,
      image: biz?.logo || "https://via.placeholder.com/640x480/111827/A78BFA?text=Coupon",
      price: pseudoPrice,
      marketValue: pseudoMarket,
      savings,
      savingsPct,
      sourceType: "future_coupon",
      category,
      trustScore: Number(biz?.trustScore || 58),
      demandLevel: coupon.demand || "medium",
      expiresAt: Number(coupon.expiresAt || now + 6 * 60 * 60 * 1000),
      rewardPoints: 0,
      sellerId: String(coupon.businessId),
      isPromoted: true,
      promotionTier: coupon.promotionTier || "basic",
      url: "https://www.ebay.com",
      popularity: Number(coupon.popularity?.clicks || 0) + Number(coupon.popularity?.redemptions || 0),
      location: biz?.location || "Online",
      saved: false,
    };
  });

  let businessOffers = [];
  try {
    const businessData = await businessOffersService.getPublicOffers();
    businessOffers = (businessData?.offers || []).map((offer) => {
      const { savings, savingsPct } = calculateSavings(offer.price, offer.marketValue);
      return { ...offer, savings, savingsPct, saved: false };
    });
  } catch (error) {
    console.warn("business.offers.public.unavailable", error?.message || error);
  }

  return dedupeOffers([...marketplace, ...couponOffers, ...businessOffers]).map((offer) => ({
    ...offer,
    rewardPoints: calculateRewardPoints(offer),
  }));
}

export default function SavvyOffers() {
  const { intent: smartIntent } = useSearchIntent();
  const [category, setCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("f10_savvy_offers_saved") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  });
  const userRegion = getUserRegionHint();
  const queryClient = useQueryClient();
  const isAuthed = Boolean(localStorage.getItem("f10_token"));
  const [trackingIds, setTrackingIds] = useState([]);
  const [claimingIds, setClaimingIds] = useState([]);
  const [programEnrollment, setProgramEnrollment] = useState(() => getEnrollment());
  const [claimMessage, setClaimMessage] = useState(null);

  useEffect(() => {
    const onUpdate = () => setProgramEnrollment(getEnrollment());
    window.addEventListener(SAVVY_PROGRAM_UPDATE_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(SAVVY_PROGRAM_UPDATE_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  const {
    data: offers = [],
    isLoading,
    isError,
    error: offersError,
    refetch: refetchOffers,
  } = useQuery({
    queryKey: ["savvy-offers"],
    queryFn: fetchOffers,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const offerIds = useMemo(() => offers.map((o) => o.id), [offers]);
  const { data: interactionsData } = useQuery({
    queryKey: ["offer-interactions", offerIds.join(",")],
    queryFn: () => offersService.getOfferInteractions(offerIds),
    enabled: isAuthed && offerIds.length > 0,
    staleTime: 60 * 1000,
  });

  const interactionsByOffer = useMemo(() => {
    const map = {};
    for (const row of interactionsData?.interactions || []) {
      map[row.offerId] = row;
    }
    return map;
  }, [interactionsData]);

  const clickMutation = useMutation({
    mutationFn: ({ offerId, offer }) => offersService.trackOfferClick(offerId, offer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer-interactions"] });
    },
  });

  const claimMutation = useMutation({
    mutationFn: ({ offerId, offer }) => offersService.claimOfferReward(offerId, offer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer-interactions"] });
      queryClient.invalidateQueries({ queryKey: ["points-me"] });
    },
  });

  const filtered = useMemo(() => {
    const ranked = rankOffers(offers, userRegion);
    const withSaved = ranked
      .filter((offer) => (category === "all" ? true : offer.category === category))
      .map((offer) => ({ ...offer, saved: savedIds.includes(offer.id) }));
    // Program decoration adds `offer.program` metadata + reprioritizes high-trust
    // listings for enrolled users. Consumers get the decoration (chips) without a
    // sort change, so the feed doesn't suddenly reshuffle when they enroll.
    return prioritizeOffersForProgram(withSaved, programEnrollment);
  }, [offers, category, savedIds, userRegion, programEnrollment]);

  const smartFiltered = useMemo(
    () =>
      filterItemsByIntent(filtered, smartIntent, {
        title: "title",
        tags: "tags",
        category: "category",
        trust: "trustScore",
        bestMove: "bestMove",
        price: "price",
        endsAt: "endsAt",
      }),
    [filtered, smartIntent]
  );

  const visibleOffers = smartFiltered.slice(0, visibleCount);

  const toggleSave = (id) => {
    const adding = !savedIds.includes(id);
    const next = adding ? [...savedIds, id] : savedIds.filter((v) => v !== id);
    setSavedIds(next);
    localStorage.setItem("f10_savvy_offers_saved", JSON.stringify(next));
    if (adding) {
      trackEvent(ANALYTICS_EVENTS.ITEM_SAVED, { surface: "savvy_offers", offerId: id });
    }
  };

  const handleTrackClick = async (offer) => {
    if (!offer?.id) return;
    // Always log program click intent (even for guests / consumers) so the
    // dashboard can show engagement. The guard-less write is safe; the tracker
    // stamps the current enrollment type onto the event.
    try {
      trackProgramEvent({ eventType: "click", offerId: offer.id, offer });
    } catch {
      /* tracking is best-effort */
    }
    if (!isAuthed) {
      window.open(offer.url, "_blank", "noopener,noreferrer");
      return;
    }
    setTrackingIds((prev) => [...prev, offer.id]);
    try {
      await clickMutation.mutateAsync({ offerId: offer.id, offer });
    } catch (error) {
      console.error("track.click.failed", error);
    } finally {
      setTrackingIds((prev) => prev.filter((id) => id !== offer.id));
      window.open(offer.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleClaim = async (offer) => {
    if (!offer?.id || !isAuthed) return;
    emitTourAction("offers", { offerId: offer.id });

    // Program-level safety: blocks duplicate claims, low-trust listings, and
    // enforces the daily claim cap per user type.
    const guard = canClaimOffer(offer);
    if (!guard.ok) {
      setClaimMessage({ id: offer.id, kind: "error", text: guard.reason });
      return;
    }

    setClaimingIds((prev) => [...prev, offer.id]);
    try {
      await claimMutation.mutateAsync({ offerId: offer.id, offer });
      // Progression signals → drives Savvy/Business Offers calling cards & emblems.
      try {
        if (offer.sourceType === "future_coupon") {
          recordCouponRedemption({ savings: Number(offer.savings) || 0 });
        } else if (offer.sourceType === "featured" || offer.sourceType === "promoted") {
          recordPartnerPurchase({ offer });
        } else if (Number(offer.savings) > 0) {
          recordPartnerPurchase({ offer });
        }
      } catch {
        /* cosmetics progression is best-effort; never block the claim */
      }
      // Compute + record the program reward *after* the base claim succeeds so
      // the dashboard reflects exactly what was paid out.
      const reward = computeOfferReward(
        { ...offer, orderValue: offer.price || 0, basePoints: offer.rewardPoints },
        programEnrollment
      );
      recordClaim(offer, {
        pointsAwarded: reward.blocked ? 0 : reward.total,
        orderValue: offer.price || 0,
      });
      if (reward.blocked) {
        setClaimMessage({ id: offer.id, kind: "warn", text: reward.reason });
      } else if (reward.multiplier > 1 || reward.bulk > 0) {
        const pct = Math.round((reward.multiplier + reward.bulk) * 100);
        setClaimMessage({
          id: offer.id,
          kind: "success",
          text: `Claimed — ${pct}% program payout (+${reward.total.toLocaleString()} Savvy).`,
        });
      }
    } catch (error) {
      console.error("claim.reward.failed", error);
    } finally {
      setClaimingIds((prev) => prev.filter((id) => id !== offer.id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GlobalSmartSearch scope="savvy-offers" listLoading={isLoading} />
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <h1
            className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-300 via-fuchsia-300 to-indigo-300 bg-clip-text text-transparent"
            data-tour="offers-header"
          >
            Savvy Offers
          </h1>
          <p className="text-gray-400 mt-2 max-w-3xl">
            The smartest place to find deals + earn rewards across eBay, promoted listings, and future coupon inventory.
          </p>
          {programEnrollment.userType === USER_TYPES.CONSUMER ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm">
              <span aria-hidden>🛡️</span>
              <span className="text-indigo-100">
                Business or first responder? Unlock enhanced payouts and curated deals.
              </span>
              <Link
                to="/savvy-programs"
                className="ml-1 rounded-lg bg-indigo-500/40 px-2 py-1 text-xs font-bold text-white hover:bg-indigo-500/60"
              >
                Enroll →
              </Link>
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm">
              <span aria-hidden>{programEnrollment.userType === USER_TYPES.BUSINESS ? "🏢" : "🛡️"}</span>
              <span className="text-amber-100">
                {programEnrollment.userType === USER_TYPES.BUSINESS ? "Business Savvy" : "Responder Savvy"}
                {" "}enrolled · Extra rewards available on eligible deals.
              </span>
              <Link
                to="/savvy-programs"
                className="ml-1 rounded-lg bg-amber-500/30 px-2 py-1 text-xs font-bold text-amber-50 hover:bg-amber-500/50"
              >
                View dashboard →
              </Link>
            </div>
          )}
        </motion.div>

        {isLoading ? (
          <div className="my-12 flex justify-center">
            <LoadingState label="Loading Savvy Offers…" />
          </div>
        ) : null}

        {isError ? (
          <div className="my-12 flex justify-center px-2">
            <ErrorState
              title="Couldn't load offers"
              description="Your deals feed didn’t load. Check your connection and try again."
              error={offersError}
              onRetry={() => void refetchOffers()}
              retryLabel="Retry"
              className="max-w-lg w-full"
            />
          </div>
        ) : null}

        {!isLoading && !isError ? (
          <>
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {OFFER_CATEGORIES.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setCategory(chip)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                category === chip
                  ? "border-purple-400/60 bg-purple-500/20 text-purple-100"
                  : "border-gray-600 bg-gray-800 text-gray-300 hover:border-purple-400/40"
              }`}
            >
              {chip.charAt(0).toUpperCase() + chip.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleOffers.map((offer, idx) => (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: idx * 0.02 }}
            >
              <div className="mb-2">
                <SavvyAlertButton
                  label="Let Savvy watch this"
                  payload={{
                    name: `${offer.title || "Offer"} • offer alert`,
                    keywords: [String(offer.title || "").slice(0, 40)],
                    maxPrice: Number(offer.price) || undefined,
                    minConfidence: 78,
                    persona: "buyer",
                    kind: "private_offer",
                    context: { source: "savvy_offers", offerId: String(offer.id || "") },
                  }}
                />
              </div>
              {(offer.program?.showBonus || offer.program?.chips?.length) ? (
                <div className="sp-offer-chip-strip" aria-label="Program perks">
                  {offer.program?.showBonus ? (
                    <span className="sp-offer-bonus" title={offer.program.bonusLabel}>
                      ✨ Extra rewards available
                    </span>
                  ) : null}
                  {offer.program?.chips?.map((chip) => (
                    <span
                      key={chip.id}
                      className={`sp-offer-chip sp-offer-chip--${chip.id === "trusted" ? "trust" : chip.id}`}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
              <OfferCard
                offer={offer}
                onToggleSave={toggleSave}
                onTrackClick={handleTrackClick}
                onClaimReward={handleClaim}
                hasClicked={Boolean(interactionsByOffer[offer.id]?.clickedAt)}
                hasClaimed={Boolean(interactionsByOffer[offer.id]?.claimedAt)}
                isTracking={trackingIds.includes(offer.id)}
                isClaiming={claimingIds.includes(offer.id)}
              />
              {claimMessage && claimMessage.id === offer.id ? (
                <div
                  className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                    claimMessage.kind === "success"
                      ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                      : claimMessage.kind === "warn"
                      ? "border border-amber-400/40 bg-amber-500/10 text-amber-100"
                      : "border border-rose-400/40 bg-rose-500/10 text-rose-100"
                  }`}
                  role="status"
                >
                  {claimMessage.text}
                </div>
              ) : null}
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No offers match this view"
              description="Try another category or clear search filters — more deals will appear here soon."
              action={
                <button
                  type="button"
                  className="f10-state__retry"
                  onClick={() => {
                    setCategory("all");
                    void refetchOffers();
                  }}
                >
                  Reset filters & retry
                </button>
              }
            />
          </div>
        ) : null}

        {visibleCount < filtered.length ? (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + 9)}
              className="rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/25"
            >
              Load more offers
            </button>
          </div>
        ) : null}

        <div className="mt-8 rounded-xl border border-gray-700 bg-gray-800/70 p-4 text-xs text-gray-400">
          Smart offer engine supports eBay deals, paid visibility offers, and future coupon/QR redemption workflows without changing card structure.
        </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

