import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  Flame,
  ShieldAlert,
  Sparkles,
  Tag,
  Ticket,
} from "lucide-react";
import { SavvyPointsIcon } from "../components/rewards/SavvyPointsIcon";
import { couponBusinesses, couponCategories, savvyCouponsMock } from "../data/savvyCouponsMock";

const COOLDOWN_MS = 1000 * 60 * 10;

function badgeForVerification(status) {
  if (status === "verified") {
    return {
      text: "Verified",
      className: "border-emerald-400/45 bg-emerald-500/15 text-emerald-200",
      icon: CheckCircle2,
    };
  }
  if (status === "pending") {
    return {
      text: "Pending",
      className: "border-amber-400/45 bg-amber-500/15 text-amber-200",
      icon: Clock3,
    };
  }
  return {
    text: "Unverified",
    className: "border-rose-400/45 bg-rose-500/15 text-rose-200",
    icon: ShieldAlert,
  };
}

function demandChip(demand) {
  if (demand === "high") return "border-rose-400/40 bg-rose-500/15 text-rose-200";
  if (demand === "medium") return "border-amber-400/40 bg-amber-500/15 text-amber-200";
  return "border-sky-400/40 bg-sky-500/15 text-sky-200";
}

function formatRemaining(ms) {
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function getUserRegionHint() {
  try {
    return localStorage.getItem("f10_user_region") || "Dallas, TX";
  } catch {
    return "Dallas, TX";
  }
}

function rankCoupons(coupons, businessesById, userRegion) {
  const now = Date.now();
  return [...coupons].sort((a, b) => {
    const bizA = businessesById[a.businessId];
    const bizB = businessesById[b.businessId];
    const verA = bizA?.verificationStatus === "verified" ? 1 : bizA?.verificationStatus === "pending" ? 0.6 : 0;
    const verB = bizB?.verificationStatus === "verified" ? 1 : bizB?.verificationStatus === "pending" ? 0.6 : 0;
    const urgA = Math.max(0, 1 - (a.expiresAt - now) / (48 * 60 * 60 * 1000));
    const urgB = Math.max(0, 1 - (b.expiresAt - now) / (48 * 60 * 60 * 1000));
    const popA = (a.popularity.clicks * 0.25) + (a.popularity.redemptions * 0.75);
    const popB = (b.popularity.clicks * 0.25) + (b.popularity.redemptions * 0.75);
    const locA = (bizA?.location || "").toLowerCase().includes(userRegion.toLowerCase()) ? 1 : bizA?.location === "Online" ? 0.6 : 0.25;
    const locB = (bizB?.location || "").toLowerCase().includes(userRegion.toLowerCase()) ? 1 : bizB?.location === "Online" ? 0.6 : 0.25;
    const scoreA = (a.savingsValue * 2.2) + (popA * 0.08) + (urgA * 22) + (locA * 10) + (verA * 15);
    const scoreB = (b.savingsValue * 2.2) + (popB * 0.08) + (urgB * 22) + (locB * 10) + (verB * 15);
    return scoreB - scoreA;
  });
}

export default function SavvyCoupons() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [now, setNow] = useState(Date.now());
  const [rewardEvents, setRewardEvents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("f10_coupon_reward_events") || "{}");
    } catch {
      return {};
    }
  });
  const [userRegion] = useState(getUserRegionHint);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem("f10_coupon_reward_events", JSON.stringify(rewardEvents));
  }, [rewardEvents]);

  const businessesById = useMemo(() => {
    return couponBusinesses.reduce((acc, b) => {
      acc[b.id] = b;
      return acc;
    }, {});
  }, []);

  const filtered = useMemo(() => {
    const base = savvyCouponsMock.filter((c) => {
      const biz = businessesById[c.businessId];
      if (!biz) return false;
      if (biz.verificationStatus === "unverified") return false;
      if (activeCategory !== "all" && c.category !== activeCategory) return false;
      return true;
    });
    return rankCoupons(base, businessesById, userRegion);
  }, [activeCategory, businessesById, userRegion]);

  const claimReward = (couponId, trigger) => {
    const key = `${couponId}:${trigger}`;
    const last = Number(rewardEvents[key] || 0);
    if (Date.now() - last < COOLDOWN_MS) return;
    setRewardEvents((prev) => ({ ...prev, [key]: Date.now() }));
  };

  return (
    <div className="min-h-screen bg-gray-900 pt-20 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-6"
        >
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-amber-300 via-orange-300 to-fuchsia-300 bg-clip-text text-transparent">
            Savvy Coupons
          </h1>
          <p className="text-gray-400 mt-2 max-w-3xl">
            High-value coupons from verified local and online businesses. Stack savings, urgency, and Savvy rewards.
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-2 mb-6">
          {couponCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                activeCategory === category
                  ? "border-amber-400/55 bg-amber-500/20 text-amber-100"
                  : "border-gray-600 bg-gray-800 text-gray-300 hover:border-amber-400/40"
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((coupon, idx) => {
            const business = businessesById[coupon.businessId];
            const verification = badgeForVerification(business.verificationStatus);
            const BadgeIcon = verification.icon;
            const remainingMs = coupon.expiresAt - now;
            const remaining = formatRemaining(remainingMs);
            const hot = remainingMs > 0 && remainingMs <= 4 * 60 * 60 * 1000;
            const demandClass = demandChip(coupon.demand);
            const clickKey = `${coupon.id}:click`;
            const redeemKey = `${coupon.id}:redeem`;
            const clickCooldown = Date.now() - Number(rewardEvents[clickKey] || 0) < COOLDOWN_MS;
            const redeemCooldown = Date.now() - Number(rewardEvents[redeemKey] || 0) < COOLDOWN_MS;
            const rewardLabel = coupon.reward.trackingStatus === "tracking_live" ? "Earn" : "Potential reward";

            return (
              <motion.article
                key={coupon.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: idx * 0.03 }}
                className={`rounded-2xl border p-5 bg-gradient-to-b from-gray-800/95 to-gray-900/95 ${
                  hot ? "border-orange-400/45 shadow-[0_0_28px_rgba(251,146,60,0.22)]" : "border-purple-500/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={business.logo}
                      alt={`${business.name} logo`}
                      className="w-10 h-10 rounded-lg bg-white/90 object-contain"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "https://via.placeholder.com/40x40/1f2937/ffffff?text=C";
                      }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-white truncate">{business.name}</h3>
                      <p className="text-xs text-gray-400">{business.location || "Online"}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${verification.className}`}>
                    <BadgeIcon className="h-3.5 w-3.5" />
                    {verification.text}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className="h-4 w-4 text-emerald-200" />
                    <span className="text-emerald-100 text-sm font-bold">{coupon.offerText}</span>
                  </div>
                  <div className="text-[11px] text-emerald-200/90">
                    Savings value: ${coupon.savingsValue}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${demandClass}`}>
                    <Flame className="h-3.5 w-3.5" />
                    Demand: {coupon.demand}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold ${
                    hot ? "border-orange-400/45 bg-orange-500/20 text-orange-200" : "border-gray-600 bg-gray-800 text-gray-300"
                  }`}>
                    <Clock3 className="h-3.5 w-3.5" />
                    {remaining}
                  </span>
                </div>

                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 text-amber-100">
                      <SavvyPointsIcon size={18} glow />
                      <span className="text-sm font-semibold">{rewardLabel} +{coupon.reward.rewardAmount} Savvy</span>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full border border-amber-300/40 bg-black/20 text-amber-200">
                      {coupon.reward.rewardType}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={clickCooldown}
                    onClick={() => claimReward(coupon.id, "click")}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      clickCooldown
                        ? "border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "border-indigo-400/45 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25"
                    }`}
                  >
                    {clickCooldown ? "Cooldown" : "Claim click reward"}
                  </button>
                  <button
                    type="button"
                    disabled={redeemCooldown}
                    onClick={() => claimReward(coupon.id, "redeem")}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                      redeemCooldown
                        ? "border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed"
                        : "border-fuchsia-400/45 bg-fuchsia-500/15 text-fuchsia-200 hover:bg-fuchsia-500/25"
                    }`}
                  >
                    {redeemCooldown ? "Cooldown" : "Redeem coupon"}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    Tier: {coupon.promotionTier}
                  </span>
                  <span>{coupon.popularity.redemptions} redeems</span>
                </div>
              </motion.article>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-8 mt-5 text-center">
            <Sparkles className="h-8 w-8 text-amber-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">No coupons in this category</h3>
            <p className="text-sm text-gray-400">Try another category. Verified businesses always get priority exposure.</p>
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-600/20 to-fuchsia-600/20 p-4">
            <h3 className="font-semibold text-white mb-1">Business console (future-ready)</h3>
            <p className="text-sm text-gray-300">
              Businesses can upload coupons, set reward amount, define expiration, and choose promotion tiers.
            </p>
          </div>
          <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-4 text-sm text-gray-300">
            QR redemption, location push, and AI “Best Coupon Near You” are supported by this structure through
            reward type, tracking status, and geo-aware ranking hooks.
          </div>
        </div>
      </div>
    </div>
  );
}

