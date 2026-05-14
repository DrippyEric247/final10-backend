/**
 * Seed feed — replace with API / real-time events later.
 * For viewed player profiles, pass a different array from the parent.
 */
export const MOCK_PROFILE_ACTIVITIES = [
  {
    id: "act-1",
    type: "auction_win",
    icon: "🏆",
    title: "Won auction",
    detail: "PS5 for $120",
    timestampMs: Date.now() - 1000 * 60 * 45,
    rewardLabel: "+450 LB pts",
  },
  {
    id: "act-2",
    type: "savvy_points",
    icon: "✨",
    title: "Savvy surge",
    detail: "Weekly activity spike",
    timestampMs: Date.now() - 1000 * 60 * 60 * 3,
    rewardLabel: "+320 savvy",
  },
  {
    id: "act-3",
    type: "streak",
    icon: "🔥",
    title: "Streak milestone",
    detail: "Hit 3-day task streak",
    timestampMs: Date.now() - 1000 * 60 * 60 * 8,
  },
  {
    id: "act-4",
    type: "rank",
    icon: "📈",
    title: "Entered Top 10",
    detail: "Leaderboard climb",
    timestampMs: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "act-5",
    type: "season",
    icon: "🎯",
    title: "Finished Neon Hunt",
    detail: "Battle pass tier cleared",
    timestampMs: Date.now() - 1000 * 60 * 60 * 50,
    rewardLabel: "Cosmetic",
  },
  {
    id: "act-6",
    type: "vip",
    icon: "👑",
    title: "Unlocked VIP Gold",
    detail: "Weekly activity held strong",
    timestampMs: Date.now() - 1000 * 60 * 60 * 72,
  },
  {
    id: "act-7",
    type: "referral",
    icon: "🤝",
    title: "Referred a friend",
    detail: "They joined Final10",
    timestampMs: Date.now() - 1000 * 60 * 60 * 96,
    rewardLabel: "+200 pts",
  },
  {
    id: "act-8",
    type: "power_boost",
    icon: "⚡",
    title: "Daily power boost",
    detail: "Claimed multiplier charge",
    timestampMs: Date.now() - 1000 * 60 * 60 * 120,
  },
];
