import { getDevFeatureTests, isDev } from "../lib/devOverride";

/**
 * Mock leaderboard players — swap for API later.
 * @typedef {{
 *   userId: string;
 *   username: string;
 *   displayName: string;
 *   score: number;
 *   rankBadge: string;
 *   vipTier: number;
 *   emblemId: string;
 *   callingCardId: string;
 *   streakWeeks: number;
 *   taskStreakWeeks: number;
 *   bpTierCleared: number;
 *   bpXp: number;
 *   bpSeasonName: string;
 *   systemsCompleted: number;
 *   powerTierLabel: string;
 *   favoriteLane: string;
 * }} MockLeaderboardPlayer
 */

export const VIP_LABELS = [
  "",
  "VIP Bronze",
  "VIP Silver",
  "VIP Gold",
  "VIP Platinum",
  "VIP Legend",
];

/** @type {MockLeaderboardPlayer[]} */
export const MOCK_LEADERBOARD_PLAYERS = [
  {
    userId: "mock-1",
    username: "NeonSniper",
    displayName: "NeonSniper",
    score: 18420,
    rankBadge: "Champion",
    vipTier: 4,
    emblemId: "sigil_bp_apex",
    callingCardId: "card_bp_finale",
    streakWeeks: 6,
    taskStreakWeeks: 4,
    bpTierCleared: 10,
    bpXp: 1500,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 6,
    powerTierLabel: "Savvy God",
    favoriteLane: "Ending-soon auctions",
  },
  {
    userId: "mock-2",
    username: "VaultQueen",
    displayName: "VaultQueen",
    score: 17205,
    rankBadge: "Elite",
    vipTier: 3,
    emblemId: "sigil_silver",
    callingCardId: "card_vault",
    streakWeeks: 5,
    taskStreakWeeks: 5,
    bpTierCleared: 9,
    bpXp: 1320,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 5,
    powerTierLabel: "Elite",
    favoriteLane: "Product feed promos",
  },
  {
    userId: "mock-3",
    username: "BundleKing",
    displayName: "BundleKing",
    score: 15990,
    rankBadge: "Elite",
    vipTier: 2,
    emblemId: "sigil_streak",
    callingCardId: "card_marathon",
    streakWeeks: 8,
    taskStreakWeeks: 3,
    bpTierCleared: 8,
    bpXp: 1100,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 5,
    powerTierLabel: "Heating Up",
    favoriteLane: "Weekly bundles",
  },
  {
    userId: "mock-4",
    username: "DealHawk",
    displayName: "DealHawk",
    score: 12440,
    rankBadge: "Diamond",
    vipTier: 2,
    emblemId: "sigil_closer",
    callingCardId: "card_sniper",
    streakWeeks: 3,
    taskStreakWeeks: 2,
    bpTierCleared: 6,
    bpXp: 780,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 4,
    powerTierLabel: "Locked In",
    favoriteLane: "Local deals",
  },
  {
    userId: "mock-5",
    username: "PromoPulse",
    displayName: "PromoPulse",
    score: 10880,
    rankBadge: "Platinum",
    vipTier: 1,
    emblemId: "sigil_promo",
    callingCardId: "card_promo_king",
    streakWeeks: 2,
    taskStreakWeeks: 4,
    bpTierCleared: 5,
    bpXp: 620,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 4,
    powerTierLabel: "Active",
    favoriteLane: "Feed visibility",
  },
  {
    userId: "mock-6",
    username: "ScanRunner",
    displayName: "ScanRunner",
    score: 9650,
    rankBadge: "Gold",
    vipTier: 0,
    emblemId: "sigil_first_save",
    callingCardId: "card_bp_neon_lane",
    streakWeeks: 1,
    taskStreakWeeks: 1,
    bpTierCleared: 4,
    bpXp: 410,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 3,
    powerTierLabel: "Active",
    favoriteLane: "Video scanner",
  },
  {
    userId: "mock-7",
    username: "StreakLite",
    displayName: "StreakLite",
    score: 8120,
    rankBadge: "Gold",
    vipTier: 0,
    emblemId: "sigil_starter",
    callingCardId: "card_default",
    streakWeeks: 2,
    taskStreakWeeks: 0,
    bpTierCleared: 3,
    bpXp: 280,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 2,
    powerTierLabel: "Base",
    favoriteLane: "Auction saves",
  },
  {
    userId: "mock-8",
    username: "QuietBidder",
    displayName: "QuietBidder",
    score: 7340,
    rankBadge: "Silver",
    vipTier: 0,
    emblemId: "sigil_first_save",
    callingCardId: "card_bp_strike",
    streakWeeks: 0,
    taskStreakWeeks: 2,
    bpTierCleared: 8,
    bpXp: 980,
    bpSeasonName: "Neon Hunt",
    systemsCompleted: 3,
    powerTierLabel: "Locked In",
    favoriteLane: "Low-competition snipes",
  },
];

function safeJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Build ranked rows: mock data + optional hydrated row for logged-in user.
 * @param {{ id?: string|number; username?: string; firstName?: string; email?: string } | null} authUser
 * @returns {(MockLeaderboardPlayer & { rank: number; isCurrentUser?: boolean })[]}
 */
export function buildRankedLeaderboard(authUser) {
  const rows = MOCK_LEADERBOARD_PLAYERS.map((p) => ({ ...p, isCurrentUser: false }));

  if (authUser) {
    const savvyBal = Math.max(0, Math.round(Number(authUser.savvyPoints) || 0));
    const meta = safeJson("f10_leaderboard_meta", {});
    const boostedFallback = Math.max(0, Math.floor(Number(meta.leaderboardScore) || 0));
    const vip = safeJson("f10_vip_rank_data", {});
    let vipTier = Math.min(5, Math.max(0, Number(vip.tier) || 0));
    if (isDev && getDevFeatureTests().leaderboardEffects) {
      vipTier = Math.max(vipTier, 4);
    }
    const savvy = safeJson("f10_savvy_sync_state", {});
    const systemsDone = Number(savvy.completedSystemsCount) || 0;

    let emblemId = "sigil_starter";
    let callingCardId = "card_default";
    try {
      emblemId = localStorage.getItem("f10_equipped_emblem") || emblemId;
      callingCardId = localStorage.getItem("f10_equipped_calling_card") || callingCardId;
    } catch {
      /* ignore */
    }

    const uname =
      authUser.username ||
      (authUser.email && String(authUser.email).split("@")[0]) ||
      "You";
    const display = authUser.firstName || uname;

    rows.push({
      userId: String(authUser.id ?? `local-${uname}`),
      username: uname,
      displayName: display,
      score: savvyBal || boostedFallback || 2100,
      rankBadge: "Rising",
      vipTier,
      emblemId,
      callingCardId,
      streakWeeks: Number(meta.streakWeeks) || 0,
      taskStreakWeeks: Number(meta.taskStreakWeeks) || 0,
      bpTierCleared: 0,
      bpXp: 0,
      bpSeasonName: "Neon Hunt",
      systemsCompleted: Math.min(6, systemsDone),
      powerTierLabel: "—",
      favoriteLane: "Your loadout",
      isCurrentUser: true,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
  }));
}
