/**
 * Emblems & calling cards: catalog + unlock checks from local progression signals.
 */

import { userHasExclusive } from "./adminCosmetics";

const DEV_UNLOCKED_CARDS_KEY = "f10_dev_unlocked_calling_cards";
const LOADOUT_UPDATED_EVENT = "f10:loadout-updated";
export const FIRST_RESPONDER_CARD_ID = "first_in_last_out";

function safeJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function getDevUnlockedCards() {
  const raw = safeJson(DEV_UNLOCKED_CARDS_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

function hasDevUnlock(cardId) {
  return getDevUnlockedCards().includes(cardId);
}

function watchlistCount() {
  const a = safeJson("f10_watchlist_ids", []);
  return Array.isArray(a) ? a.length : 0;
}

function promotedCount() {
  const a = safeJson("f10_promoted_item_ids", []);
  return Array.isArray(a) ? a.length : 0;
}

function getWeekKeyUTC(timestampMs) {
  const d = new Date(timestampMs);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function bundleStreakDisplay() {
  const raw = safeJson("f10_bundle_streak_data", {});
  const streak = Number(raw.streak) || 0;
  const weeks = raw.completedWeeks && typeof raw.completedWeeks === "object" ? raw.completedWeeks : {};
  const currentWeekKey = getWeekKeyUTC(Date.now());
  const weekDone = Boolean(weeks[currentWeekKey]);
  return streak + (weekDone ? 1 : 0);
}

function leaderboardScore() {
  const meta = safeJson("f10_leaderboard_meta", {});
  const n = Number(meta.leaderboardScore);
  return Number.isFinite(n) ? n : 0;
}

/** Registered by `SavvyPointsProvider` from `user.savvyPoints` — avoids a duplicate balance in localStorage. */
let savvyBalanceGetter = null;

export function registerSavvyBalanceGetter(fn) {
  savvyBalanceGetter = typeof fn === "function" ? fn : null;
}

function savvyBalanceForUnlocks() {
  if (savvyBalanceGetter) {
    try {
      const n = Number(savvyBalanceGetter());
      if (Number.isFinite(n)) return Math.max(0, Math.round(n));
    } catch {
      /* fallthrough */
    }
  }
  return 0;
}

function dealClickCount() {
  const n = Number(localStorage.getItem("f10_deal_click_count"));
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Offers-progression signals
// ---------------------------------------------------------------------------
// Cheap numeric counters kept in localStorage so the unlock checks stay pure
// reads. Recorder functions below are the only writers.

const KEY_COUPON_REDEMPTIONS = "f10_coupon_redemptions";
const KEY_PARTNER_PURCHASES = "f10_partner_purchases";
const KEY_VERIFIED_PURCHASES = "f10_verified_purchases";
const KEY_REFERRALS = "f10_referrals";
const KEY_HIDDEN_DISCOUNTS = "f10_hidden_discounts";
const KEY_STACKED_DEALS = "f10_stacked_deals";
const KEY_VIP_ACCESS = "f10_vip_access_count";
const KEY_OFFERS_SAVINGS = "f10_offers_total_savings";
const KEY_STACK_LOG = "f10_stack_log";

function readNum(key) {
  const n = Number(typeof localStorage === "undefined" ? 0 : localStorage.getItem(key));
  return Number.isFinite(n) ? n : 0;
}

function bumpNum(key, by = 1) {
  try {
    localStorage.setItem(key, String(readNum(key) + Number(by || 0)));
  } catch {
    /* ignore */
  }
}

function couponRedemptions() { return readNum(KEY_COUPON_REDEMPTIONS); }
function partnerPurchases() { return readNum(KEY_PARTNER_PURCHASES); }
function verifiedPurchases() { return readNum(KEY_VERIFIED_PURCHASES); }
function referrals() { return readNum(KEY_REFERRALS); }
function hiddenDiscounts() { return readNum(KEY_HIDDEN_DISCOUNTS); }
function stackedDeals() { return readNum(KEY_STACKED_DEALS); }
function vipAccessCount() { return readNum(KEY_VIP_ACCESS); }
function offersTotalSavings() { return readNum(KEY_OFFERS_SAVINGS); }

/**
 * Detects a stack by logging each distinct claim and watching the 24-hour
 * window — when 3+ claims land in the same window the user earns "Stack
 * Master" permanently (we only bump the counter; we never reset it).
 */
function noteDistinctClaim() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_STACK_LOG) || "[]");
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = (Array.isArray(raw) ? raw : []).filter((t) => Number(t) >= cutoff);
    recent.push(Date.now());
    const capped = recent.slice(-20);
    localStorage.setItem(KEY_STACK_LOG, JSON.stringify(capped));
    if (recent.length >= 3) bumpNum(KEY_STACKED_DEALS);
  } catch {
    /* ignore */
  }
}

/** Record a coupon redemption (Savvy Offers → future_coupon tier). */
export function recordCouponRedemption({ savings = 0 } = {}) {
  bumpNum(KEY_COUPON_REDEMPTIONS);
  const s = Number(savings) || 0;
  if (s > 0) bumpNum(KEY_OFFERS_SAVINGS, Math.round(s));
  noteDistinctClaim();
}

/** Record a claim/purchase from a partner/business offer. */
export function recordPartnerPurchase({ offer } = {}) {
  bumpNum(KEY_PARTNER_PURCHASES);
  const savings = Number(offer?.savings) || 0;
  if (savings > 0) bumpNum(KEY_OFFERS_SAVINGS, Math.round(savings));
  const pct = Number(offer?.savingsPct) || 0;
  const featured =
    offer && (offer.promotionTier === "featured" || offer.sourceType === "featured");
  const verified =
    offer?.verified === true ||
    offer?.verificationStatus === "verified" ||
    Number(offer?.trustScore) >= 92;
  if (verified) bumpNum(KEY_VERIFIED_PURCHASES);
  if (featured) bumpNum(KEY_VIP_ACCESS);
  if (pct >= 50 || offer?.hidden === true) bumpNum(KEY_HIDDEN_DISCOUNTS);
  noteDistinctClaim();
}

/** Record a completed referral (when your referral flow lands). */
export function recordReferral() {
  bumpNum(KEY_REFERRALS);
}

/** Manually mark a "hidden" deal discovery (e.g. savvy assistant surfaced one). */
export function recordHiddenDiscountFound() {
  bumpNum(KEY_HIDDEN_DISCOUNTS);
}

/** Read-only snapshot for UI/diagnostics. */
export function getOffersProgression() {
  return {
    couponRedemptions: couponRedemptions(),
    partnerPurchases: partnerPurchases(),
    verifiedPurchases: verifiedPurchases(),
    referrals: referrals(),
    hiddenDiscounts: hiddenDiscounts(),
    stackedDeals: stackedDeals(),
    vipAccess: vipAccessCount(),
    totalSavings: offersTotalSavings(),
  };
}

/** Battle Pass season cosmetic unlocks */
export function bpCosmeticUnlocked(id) {
  const a = safeJson("f10_bp_unlocked_cosmetics", []);
  return Array.isArray(a) && a.includes(id);
}

/** Record a Final10 “closer” moment (call from auction win flow when you add it). */
export function recordFinal10CloserBadge() {
  try {
    localStorage.setItem("f10_final10_closer_badge", "1");
  } catch {
    /* ignore */
  }
}

export function isCloserBadgeEarned() {
  return localStorage.getItem("f10_final10_closer_badge") === "1";
}

export const EMBLEMS = [
  {
    id: "sigil_starter",
    name: "Starter Sigil",
    subtitle: "Every legend starts somewhere",
    glyph: "✦",
    accent: "linear-gradient(135deg, #a78bfa, #fbbf24)",
    requirement: "Unlocked by default",
    check: () => true,
  },
  {
    id: "sigil_first_save",
    name: "Bookmarked",
    subtitle: "You stack what matters",
    glyph: "⭐",
    accent: "linear-gradient(135deg, #fbbf24, #f97316)",
    requirement: "Save your first item to watchlist",
    check: () => watchlistCount() >= 1,
  },
  {
    id: "sigil_streak",
    name: "Streak Core",
    subtitle: "Consistency pays",
    glyph: "🔥",
    accent: "linear-gradient(135deg, #f97316, #ef4444)",
    requirement: "Hold a 2+ week bundle streak",
    check: () => bundleStreakDisplay() >= 2,
  },
  {
    id: "sigil_silver",
    name: "Silver Crown",
    subtitle: "Rank has its shine",
    glyph: "👑",
    accent: "linear-gradient(135deg, #94a3b8, #e2e8f0)",
    requirement: "Reach Silver — 3,000+ leaderboard score",
    check: () => leaderboardScore() >= 3000,
  },
  {
    id: "sigil_promo",
    name: "Visibility Spike",
    subtitle: "You put listings in the beam",
    glyph: "📣",
    accent: "linear-gradient(135deg, #a855f7, #6366f1)",
    requirement: "Promote 3+ listings",
    check: () => promotedCount() >= 3,
  },
  {
    id: "sigil_closer",
    name: "Final Closer",
    subtitle: "You finish on the buzzer",
    glyph: "⚡",
    accent: "linear-gradient(135deg, #22d3ee, #a78bfa)",
    requirement: "Win a Final10 ending-soon chase or earn Closer status",
    check: () => isCloserBadgeEarned() || dealClickCount() >= 12,
  },
  {
    id: "sigil_bp_neon",
    name: "Neon Sigil",
    subtitle: "Battle Pass — Neon Hunt",
    glyph: "◆",
    accent: "linear-gradient(135deg, #22d3ee, #a855f7)",
    requirement: "Neon Hunt Battle Pass (premium tier 3)",
    check: () => bpCosmeticUnlocked("sigil_bp_neon"),
  },
  {
    id: "sigil_bp_hunter",
    name: "Hunter Mark",
    subtitle: "Battle Pass — mid-season",
    glyph: "◎",
    accent: "linear-gradient(135deg, #f97316, #eab308)",
    requirement: "Neon Hunt Battle Pass (free tier 7)",
    check: () => bpCosmeticUnlocked("sigil_bp_hunter"),
  },
  {
    id: "sigil_bp_apex",
    name: "Apex Crest",
    subtitle: "Battle Pass — finale",
    glyph: "✧",
    accent: "linear-gradient(135deg, #fbbf24, #ef4444)",
    requirement: "Neon Hunt Battle Pass (premium tier 10)",
    check: () => bpCosmeticUnlocked("sigil_bp_apex"),
  },

  // ---------- Savvy Offers emblems ----------
  {
    id: "sigil_coupon_scissor",
    name: "Coupon Sigil",
    subtitle: "Clipped with intent",
    glyph: "✂",
    group: "savvy_offers",
    accent: "linear-gradient(135deg, #22d3ee, #38bdf8)",
    requirement: "Redeem 1 coupon",
    check: () => couponRedemptions() >= 1,
  },
  {
    id: "sigil_gift_box",
    name: "Gift Drop",
    subtitle: "Reward unpacked",
    glyph: "🎁",
    group: "savvy_offers",
    accent: "linear-gradient(135deg, #f472b6, #a855f7)",
    requirement: "Redeem 3 coupons",
    check: () => couponRedemptions() >= 3,
  },
  {
    id: "sigil_lightning_deal",
    name: "Lightning Deal",
    subtitle: "First to the strike",
    glyph: "⚡",
    group: "savvy_offers",
    accent: "linear-gradient(135deg, #facc15, #f97316)",
    requirement: "Stack 3 deals in a day",
    check: () => stackedDeals() >= 1,
  },
  {
    id: "sigil_dollar_spark",
    name: "Dollar Spark",
    subtitle: "Savings in motion",
    glyph: "💲",
    group: "savvy_offers",
    accent: "linear-gradient(135deg, #34d399, #22d3ee)",
    requirement: "Save $100 total on offers",
    check: () => offersTotalSavings() >= 100,
  },

  // ---------- Business Offers emblems ----------
  {
    id: "sigil_storefront",
    name: "Storefront",
    subtitle: "Partner doors open",
    glyph: "🏬",
    group: "business_offers",
    accent: "linear-gradient(135deg, #6366f1, #22d3ee)",
    requirement: "Claim 1 partner offer",
    check: () => partnerPurchases() >= 1,
  },
  {
    id: "sigil_verified_badge",
    name: "Verified Badge",
    subtitle: "Real purchase, real proof",
    glyph: "✅",
    group: "business_offers",
    accent: "linear-gradient(135deg, #10b981, #065f46)",
    requirement: "Complete 1 verified partner purchase",
    check: () => verifiedPurchases() >= 1,
  },
  {
    id: "sigil_growth_chart",
    name: "Growth Line",
    subtitle: "Numbers go up",
    glyph: "📈",
    group: "business_offers",
    accent: "linear-gradient(135deg, #f97316, #fbbf24)",
    requirement: "Access 3 VIP/featured offers",
    check: () => vipAccessCount() >= 3,
  },
  {
    id: "sigil_network",
    name: "Network",
    subtitle: "Plugged into the lane",
    glyph: "🕸",
    group: "business_offers",
    accent: "linear-gradient(135deg, #a855f7, #ec4899)",
    requirement: "Refer 1 business",
    check: () => referrals() >= 1,
  },

  // ---------- Influencer emblems (exclusive · manual grant) ----------
  {
    id: "sigil_savvy_creator",
    name: "Creator Mark",
    subtitle: "Built an audience around the lane",
    glyph: "🎬",
    group: "exclusive_influencer",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #fb7185, #f472b6)",
    requirement: "Influencer partners only",
    check: () => userHasExclusive("sigil_savvy_creator"),
  },
  {
    id: "sigil_viral_engine",
    name: "Viral Engine",
    subtitle: "Content that moves the room",
    glyph: "📣",
    group: "exclusive_influencer",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #fb923c, #f43f5e)",
    requirement: "Influencer partners only",
    check: () => userHasExclusive("sigil_viral_engine"),
  },
  {
    id: "sigil_deal_amplifier",
    name: "Amplifier",
    subtitle: "Deals on blast",
    glyph: "📡",
    group: "exclusive_influencer",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #a855f7, #ec4899)",
    requirement: "Influencer partners only",
    check: () => userHasExclusive("sigil_deal_amplifier"),
  },

  // ---------- Developer emblems (exclusive · dev/admin only) ----------
  {
    id: "sigil_system_architect",
    name: "Architect",
    subtitle: "Designed the lane",
    glyph: "🧠",
    group: "exclusive_dev",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #22d3ee, #6366f1)",
    requirement: "Developer grant only",
    check: () => userHasExclusive("sigil_system_architect"),
  },
  {
    id: "sigil_savvy_core",
    name: "Savvy Core",
    subtitle: "Runs beneath the surface",
    glyph: "⚙",
    group: "exclusive_dev",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #0ea5e9, #22d3ee)",
    requirement: "Developer grant only",
    check: () => userHasExclusive("sigil_savvy_core"),
  },
  {
    id: "sigil_debug_king",
    name: "Debug Crown",
    subtitle: "Breaks it, then fixes it",
    glyph: "🪲",
    group: "exclusive_dev",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #34d399, #0ea5e9)",
    requirement: "Developer grant only",
    check: () => userHasExclusive("sigil_debug_king"),
  },

  // ---------- Founders / Elite emblems (ultra-rare · manual grant) ----------
  {
    id: "sigil_founders_circle",
    name: "Founders Mark",
    subtitle: "Day-zero operator",
    glyph: "☯",
    group: "exclusive_founders",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #fbbf24, #a855f7)",
    requirement: "Founders grant only",
    check: () => userHasExclusive("sigil_founders_circle"),
  },
  {
    id: "sigil_savvy_elite",
    name: "Savvy Elite",
    subtitle: "Proven at the top of the board",
    glyph: "♛",
    group: "exclusive_founders",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #facc15, #ec4899)",
    requirement: "Elite grant only",
    check: () => userHasExclusive("sigil_savvy_elite"),
  },
  {
    id: "sigil_the_signal",
    name: "The Signal",
    subtitle: "You are the bell",
    glyph: "✦",
    group: "exclusive_founders",
    rarity: "exclusive",
    accent: "linear-gradient(135deg, #fde047, #7c3aed)",
    requirement: "Legendary grant only",
    check: () => userHasExclusive("sigil_the_signal"),
  },
];

export const CALLING_CARDS = [
  {
    id: "card_default",
    name: "Clean Signal",
    tagline: "Final10 Operator",
    rarity: "common",
    stripe: "linear-gradient(90deg, #1e1b4b, #312e81 40%, #4c1d95)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.25), transparent)",
    requirement: "Unlocked by default",
    check: () => true,
  },
  {
    id: FIRST_RESPONDER_CARD_ID,
    name: "First In, Last Out",
    tagline: "Savvy First Responder",
    collection: "Savvy First Responder",
    rarity: "legendary",
    tier: "supporter",
    unlockType: "event",
    isAnimated: true,
    description: "For those who show up first and leave last.",
    displayTitle: "FIRST IN. LAST OUT.",
    displaySubtitle: "Savvy First Responder",
    stripe:
      "linear-gradient(112deg, #090f1c 0%, #132035 28%, #1f0f15 52%, #111f37 76%, #090f1c 100%)",
    flare:
      "linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.28) 30%, rgba(248,113,113,0.34) 52%, rgba(250,204,21,0.24) 70%, transparent 100%)",
    requirement: "Event participation or dev grant",
    check: () => hasDevUnlock(FIRST_RESPONDER_CARD_ID) || userHasExclusive(FIRST_RESPONDER_CARD_ID),
    animationPreset: "first_responder",
  },
  {
    id: "first_in_last_out_verified",
    name: "First In, Last Out (Verified)",
    tagline: "Savvy First Responder · Verified",
    collection: "Savvy First Responder",
    rarity: "exclusive",
    tier: "verified",
    unlockType: "verified",
    isAnimated: true,
    description: "Verified First Responder version coming soon.",
    displayTitle: "FIRST IN. LAST OUT.",
    displaySubtitle: "Verified First Responder (Coming Soon)",
    stripe:
      "linear-gradient(112deg, #06080f 0%, #102239 28%, #2b0f17 52%, #111f37 76%, #06080f 100%)",
    flare:
      "linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.24) 28%, rgba(248,113,113,0.3) 48%, rgba(250,204,21,0.3) 70%, transparent 100%)",
    requirement: "Verified First Responder version coming soon.",
    check: () => false,
    animationPreset: "first_responder",
  },
  {
    id: "card_sniper",
    name: "Sniper Lane",
    tagline: "Low competition · High intent",
    rarity: "rare",
    stripe: "linear-gradient(90deg, #0f172a, #14532d 45%, #022c22)",
    flare: "linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.35), transparent)",
    requirement: "Save 3+ items to your watchlist",
    check: () => watchlistCount() >= 3,
  },
  {
    id: "card_promo_king",
    name: "Promo King",
    tagline: "Boosted visibility on lock",
    rarity: "epic",
    stripe: "linear-gradient(90deg, #3b0764, #6d28d9 50%, #1e1b4b)",
    flare: "linear-gradient(90deg, transparent, rgba(192, 132, 252, 0.4), transparent)",
    requirement: "Promote 5+ listings",
    check: () => promotedCount() >= 5,
  },
  {
    id: "card_marathon",
    name: "Marathon Stack",
    tagline: "Weeks on weeks",
    rarity: "rare",
    stripe: "linear-gradient(90deg, #431407, #9a3412 40%, #7c2d12)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 146, 60, 0.35), transparent)",
    requirement: "Reach a 4+ week bundle streak",
    check: () => bundleStreakDisplay() >= 4,
  },
  {
    id: "card_vault",
    name: "Vault Elite",
    tagline: "Points speak louder",
    rarity: "epic",
    stripe: "linear-gradient(90deg, #0c4a6e, #0369a1 45%, #082f49)",
    flare: "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.35), transparent)",
    requirement: "Earn 500+ Savvy",
    check: () => savvyBalanceForUnlocks() >= 500,
  },
  {
    id: "card_streak_30",
    name: "Monthly Operator",
    tagline: "30-day streak elite",
    rarity: "legendary",
    stripe: "linear-gradient(90deg, #431407, #ea580c 45%, #7c2d12)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 146, 60, 0.45), transparent)",
    requirement: "Reach a 30-day login streak",
    check: () => bpCosmeticUnlocked("card_streak_30"),
  },
  {
    id: "card_welcome_back",
    name: "Welcome Back",
    tagline: "The Scout saved your seat",
    rarity: "epic",
    stripe: "linear-gradient(90deg, #064e3b, #059669 45%, #134e4a)",
    flare: "linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.4), transparent)",
    requirement: "Return after 30 days away",
    check: () => bpCosmeticUnlocked("card_welcome_back"),
  },
  {
    id: "card_legacy_loyalist",
    name: "Legacy Loyalist",
    tagline: "Hidden · 100-day secret",
    rarity: "legendary",
    stripe: "linear-gradient(90deg, #312e81, #7c3aed 45%, #4c1d95)",
    flare: "linear-gradient(90deg, transparent, rgba(167, 139, 250, 0.45), transparent)",
    requirement: "Hidden: 100-day streak achievement",
    check: () => bpCosmeticUnlocked("card_legacy_loyalist"),
  },
  {
    id: "card_bp_neon_lane",
    name: "Neon Lane",
    tagline: "Battle Pass operator",
    rarity: "epic",
    stripe: "linear-gradient(90deg, #0e7490, #6d28d9 50%, #1e1b4b)",
    flare: "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.4), transparent)",
    requirement: "Neon Hunt Battle Pass (premium tier 4)",
    check: () => bpCosmeticUnlocked("card_bp_neon_lane"),
  },
  {
    id: "card_bp_strike",
    name: "Strike Team",
    tagline: "Fast saves · fast wins",
    rarity: "legendary",
    stripe: "linear-gradient(90deg, #1c1917, #b45309 42%, #422006)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.35), transparent)",
    requirement: "Neon Hunt Battle Pass (free tier 8)",
    check: () => bpCosmeticUnlocked("card_bp_strike"),
  },
  {
    id: "card_bp_finale",
    name: "Season Finale",
    tagline: "Neon Hunt complete",
    rarity: "legendary",
    stripe: "linear-gradient(90deg, #4c0519, #be123c 45%, #312e81)",
    flare: "linear-gradient(90deg, transparent, rgba(244, 63, 94, 0.35), transparent)",
    requirement: "Neon Hunt Battle Pass (free tier 10)",
    check: () => bpCosmeticUnlocked("card_bp_finale"),
  },

  // ---------- Savvy Offers calling cards ----------
  {
    id: "card_coupon_sniper",
    name: "Coupon Sniper",
    tagline: "Pinpoint saves · clean hits",
    rarity: "rare",
    group: "savvy_offers",
    stripe: "linear-gradient(90deg, #0e7490, #0891b2 45%, #0c4a6e)",
    flare: "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.4), transparent)",
    requirement: "Redeem 5 coupons",
    check: () => couponRedemptions() >= 5,
  },
  {
    id: "card_stack_master",
    name: "Stack Master",
    tagline: "Three deals · one run",
    rarity: "elite",
    group: "savvy_offers",
    stripe: "linear-gradient(90deg, #064e3b, #047857 45%, #0f766e)",
    flare: "linear-gradient(90deg, transparent, rgba(45, 212, 191, 0.45), transparent)",
    requirement: "Stack 3 deals in 24 hours",
    check: () => stackedDeals() >= 1,
  },
  {
    id: "card_savvy_saver",
    name: "Savvy Saver",
    tagline: "$100 banked on offers",
    rarity: "rare",
    group: "savvy_offers",
    stripe: "linear-gradient(90deg, #134e4a, #15803d 45%, #052e16)",
    flare: "linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.4), transparent)",
    requirement: "Save $100 total on offers",
    check: () => offersTotalSavings() >= 100,
  },
  {
    id: "card_hidden_discount",
    name: "Hidden Discount",
    tagline: "Found what others missed",
    rarity: "legendary",
    group: "savvy_offers",
    stripe: "linear-gradient(90deg, #4c1d95, #a21caf 45%, #1e1b4b)",
    flare: "linear-gradient(90deg, transparent, rgba(232, 121, 249, 0.45), transparent)",
    requirement: "Claim a 50%+ off rare deal",
    check: () => hiddenDiscounts() >= 1,
  },

  // ---------- Business Offers calling cards ----------
  {
    id: "card_deal_partner",
    name: "Deal Partner",
    tagline: "Three brands · one operator",
    rarity: "rare",
    group: "business_offers",
    stripe: "linear-gradient(90deg, #1e1b4b, #4338ca 45%, #312e81)",
    flare: "linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.4), transparent)",
    requirement: "Buy from 3 partner brands",
    check: () => partnerPurchases() >= 3,
  },
  {
    id: "card_verified_buyer",
    name: "Verified Buyer",
    tagline: "Receipts on lock",
    rarity: "elite",
    group: "business_offers",
    stripe: "linear-gradient(90deg, #064e3b, #059669 45%, #022c22)",
    flare: "linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.45), transparent)",
    requirement: "Complete a verified partner purchase",
    check: () => verifiedPurchases() >= 1,
  },
  {
    id: "card_brand_insider",
    name: "Brand Insider",
    tagline: "VIP access unlocked",
    rarity: "elite",
    group: "business_offers",
    stripe: "linear-gradient(90deg, #1e1b4b, #b45309 48%, #422006)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.45), transparent)",
    requirement: "Access 3 VIP/featured offers",
    check: () => vipAccessCount() >= 3,
  },
  {
    id: "card_savvy_affiliate",
    name: "Savvy Affiliate",
    tagline: "You put the plug in the network",
    rarity: "legendary",
    group: "business_offers",
    stripe: "linear-gradient(90deg, #0f172a, #9d174d 45%, #1e1b4b)",
    flare: "linear-gradient(90deg, transparent, rgba(244, 114, 182, 0.45), transparent)",
    requirement: "Refer 1 business",
    check: () => referrals() >= 1,
  },

  // ---------- Influencer calling cards (exclusive) ----------
  {
    id: "card_savvy_creator",
    name: "Savvy Creator",
    tagline: "Attention is the opening move",
    rarity: "exclusive",
    group: "exclusive_influencer",
    stripe: "linear-gradient(90deg, #4a044e, #be185d 48%, #1e1b4b)",
    flare: "linear-gradient(90deg, transparent, rgba(244, 114, 182, 0.5), transparent)",
    requirement: "Granted to verified influencers",
    check: () => userHasExclusive("card_savvy_creator"),
  },
  {
    id: "card_viral_engine",
    name: "Viral Engine",
    tagline: "Every post turns into traction",
    rarity: "exclusive",
    group: "exclusive_influencer",
    stripe: "linear-gradient(90deg, #831843, #db2777 45%, #7c3aed)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 113, 133, 0.55), transparent)",
    requirement: "Granted by Final10 partnerships",
    check: () => userHasExclusive("card_viral_engine"),
  },
  {
    id: "card_deal_amplifier",
    name: "Deal Amplifier",
    tagline: "One push moves the crowd",
    rarity: "exclusive",
    group: "exclusive_influencer",
    stripe: "linear-gradient(90deg, #7c2d12, #ea580c 45%, #831843)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 146, 60, 0.55), transparent)",
    requirement: "Granted by Final10 partnerships",
    check: () => userHasExclusive("card_deal_amplifier"),
  },

  // ---------- Developer calling cards (exclusive) ----------
  {
    id: "card_system_architect",
    name: "System Architect",
    tagline: "Built the lane from the bones out",
    rarity: "exclusive",
    group: "exclusive_dev",
    stripe: "linear-gradient(90deg, #082f49, #0369a1 45%, #1e1b4b)",
    flare: "linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.55), transparent)",
    requirement: "Developer grant only",
    check: () => userHasExclusive("card_system_architect"),
  },
  {
    id: "card_savvy_core",
    name: "Savvy Core",
    tagline: "The engine under the engine",
    rarity: "exclusive",
    group: "exclusive_dev",
    stripe: "linear-gradient(90deg, #0f172a, #1e40af 45%, #083344)",
    flare: "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.55), transparent)",
    requirement: "Developer grant only",
    check: () => userHasExclusive("card_savvy_core"),
  },
  {
    id: "card_debug_king",
    name: "Debug King",
    tagline: "Hunts what others can't see",
    rarity: "exclusive",
    group: "exclusive_dev",
    stripe: "linear-gradient(90deg, #064e3b, #0ea5e9 48%, #134e4a)",
    flare: "linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.55), transparent)",
    requirement: "Developer grant only",
    check: () => userHasExclusive("card_debug_king"),
  },

  // ---------- Founders / Elite calling cards (ultra-rare) ----------
  {
    id: "card_founders_circle",
    name: "Founders Circle",
    tagline: "Before the app had a name",
    rarity: "exclusive",
    group: "exclusive_founders",
    stripe: "linear-gradient(90deg, #1e1b4b, #7c2d12 50%, #1e1b4b)",
    flare: "linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.55), transparent)",
    requirement: "Founders grant only",
    check: () => userHasExclusive("card_founders_circle"),
  },
  {
    id: "card_savvy_elite",
    name: "Savvy Elite",
    tagline: "Top of the board. End of the conversation.",
    rarity: "exclusive",
    group: "exclusive_founders",
    stripe: "linear-gradient(90deg, #422006, #f59e0b 45%, #4c0519)",
    flare: "linear-gradient(90deg, transparent, rgba(253, 224, 71, 0.55), transparent)",
    requirement: "Elite leaderboard + admin grant",
    check: () => userHasExclusive("card_savvy_elite"),
  },
  {
    id: "card_the_signal",
    name: "The Signal",
    tagline: "Others watch the market. You are the market.",
    rarity: "exclusive",
    group: "exclusive_founders",
    stripe: "linear-gradient(90deg, #0b132b, #7c3aed 45%, #4a044e)",
    flare: "linear-gradient(90deg, transparent, rgba(253, 224, 71, 0.55), rgba(192, 132, 252, 0.45), transparent)",
    requirement: "Ultra-rare · manual grant only",
    check: () => userHasExclusive("card_the_signal"),
  },
];

/**
 * Normalized card model for UI tooling and future API parity.
 */
export const callingCards = CALLING_CARDS.map((card) => ({
  id: card.id,
  name: card.name,
  collection: card.collection || "Core",
  rarity: String(card.rarity || "common"),
  tier: card.tier || "core",
  unlockType: card.unlockType || "progression",
  isAnimated: Boolean(card.isAnimated),
  description: card.description || card.tagline || "",
}));

const EMBLEM_KEY = "f10_equipped_emblem";
const CARD_KEY = "f10_equipped_calling_card";

export function getEquippedEmblemId() {
  return localStorage.getItem(EMBLEM_KEY) || "sigil_starter";
}

export function getEquippedCallingCardId() {
  return localStorage.getItem(CARD_KEY) || "card_default";
}

export function setEquippedEmblemId(id) {
  try {
    localStorage.setItem(EMBLEM_KEY, id);
    window.dispatchEvent(new CustomEvent(LOADOUT_UPDATED_EVENT, { detail: { emblemId: id } }));
  } catch {
    /* ignore */
  }
}

export function setEquippedCallingCardId(id) {
  try {
    localStorage.setItem(CARD_KEY, id);
    window.dispatchEvent(new CustomEvent(LOADOUT_UPDATED_EVENT, { detail: { callingCardId: id } }));
  } catch {
    /* ignore */
  }
}

export function unlockCallingCardForDev(cardId) {
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production") {
    return false;
  }
  const id = String(cardId || "").trim();
  if (!id) return false;
  const existing = getDevUnlockedCards();
  if (existing.includes(id)) return true;
  try {
    localStorage.setItem(DEV_UNLOCKED_CARDS_KEY, JSON.stringify([...existing, id]));
    window.dispatchEvent(new CustomEvent(LOADOUT_UPDATED_EVENT, { detail: { unlockedCardId: id } }));
    return true;
  } catch {
    return false;
  }
}

/** Dev-only: mark every catalog calling card as locally unlocked. */
export function unlockAllCallingCardsForDev() {
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production") return;
  CALLING_CARDS.forEach((c) => {
    unlockCallingCardForDev(c.id);
  });
}

export function getEquippedLoadout() {
  return {
    equippedEmblemId: getEquippedEmblemId(),
    equippedCallingCardId: getEquippedCallingCardId(),
  };
}

export function findEmblem(id) {
  return EMBLEMS.find((e) => e.id === id) || EMBLEMS[0];
}

export function findCallingCard(id) {
  return CALLING_CARDS.find((c) => c.id === id) || CALLING_CARDS[0];
}
