import type { SeasonDefinition } from "../types/battlePassTasks";

/** Neon Hunt — fast auctions, clutch bids, power building */
export const NEON_HUNT_TASK_SEASON: SeasonDefinition = {
  id: "neon_hunt_s1",
  name: "Neon Hunt",
  theme: "Fast, clutch, competitive",
  description:
    "Chase ending-soon deals, strike in the final minutes, and stack power for the leaderboard climb.",
  themeUi: {
    accent: "#22d3ee",
    accent2: "#a855f7",
    glow: "rgba(34, 211, 238, 0.45)",
    surface: "rgba(15, 23, 42, 0.55)",
  },
  tasks: [
    {
      id: "nh_daily_scan_grid",
      title: "Scan the Grid",
      description: "Check 3 auctions ending soon.",
      type: "daily",
      themeTag: "Neon Snipe",
      requirement: 3,
      metricKey: "scan_ending_soon",
      reward: { xp: 25, savvyPoints: 15, bonus: { kind: "power_lint", value: 0.005, label: "+0.005× power lint" } },
    },
    {
      id: "nh_daily_quick_trigger",
      title: "Quick Trigger",
      description: "Place 1 bid in the final 10 minutes of an auction.",
      type: "daily",
      themeTag: "Clutch",
      requirement: 1,
      metricKey: "bid_final_ten",
      reward: { xp: 35, savvyPoints: 20 },
    },
    {
      id: "nh_daily_power_charge",
      title: "Power Charge",
      description: "Claim your daily power boost.",
      type: "daily",
      themeTag: "Power Build",
      requirement: 1,
      metricKey: "daily_power_claimed",
      reward: { xp: 15, savvyPoints: 10 },
    },
    {
      id: "nh_weekly_auction_hunter",
      title: "Auction Hunter",
      description: "Win 3 auctions this week.",
      type: "weekly",
      themeTag: "Neon Snipe",
      requirement: 3,
      metricKey: "auction_wins_week",
      reward: { xp: 120, savvyPoints: 80, bonus: { kind: "power_lint", value: 0.01, label: "+0.01× power lint" } },
    },
    {
      id: "nh_weekly_momentum",
      title: "Momentum Builder",
      description: "Earn 1,500 savvy points (weekly activity).",
      type: "weekly",
      themeTag: "Savvy",
      requirement: 1500,
      metricKey: "savvy_points_week",
      reward: { xp: 90, savvyPoints: 50 },
    },
    {
      id: "nh_weekly_locked_in",
      title: "Stay Locked In",
      description: "Maintain a 3-day streak (bundle or task).",
      type: "weekly",
      themeTag: "Power Build",
      requirement: 3,
      metricKey: "streak_days_best",
      reward: { xp: 75, savvyPoints: 40 },
    },
    {
      id: "nh_season_neon_snipe",
      title: "Neon Snipe",
      description: "Win an auction with under 10 seconds remaining.",
      type: "season",
      themeTag: "Neon Snipe",
      requirement: 1,
      metricKey: "neon_snipe_win",
      reward: { xp: 200, savvyPoints: 100, bonus: { kind: "label", label: "Neon Snipe flair" } },
    },
    {
      id: "nh_season_climb",
      title: "Climb the Ranks",
      description: "Move up 10 leaderboard spots vs your season start anchor.",
      type: "season",
      themeTag: "Competitive",
      requirement: 10,
      metricKey: "rank_gain_season",
      reward: { xp: 150, savvyPoints: 60 },
    },
    {
      id: "nh_season_power_surge",
      title: "Power Surge",
      description: "Reach at least 1.5× power multiplier.",
      type: "season",
      themeTag: "Power Build",
      requirement: 1,
      metricKey: "power_multiplier_threshold",
      reward: { xp: 100, savvyPoints: 45 },
    },
    {
      id: "nh_season_full_override",
      title: "Full System Override",
      description: "Complete 10 total missions (daily or weekly) this season.",
      type: "season",
      themeTag: "Override",
      requirement: 10,
      metricKey: "season_missions_completed_tally",
      reward: { xp: 250, savvyPoints: 120, bonus: { kind: "power_lint", value: 0.02, label: "+0.02× power lint" } },
    },
  ],
};

/** Placeholder seasons — expand task lists when those seasons go live. */
export const VAULT_WARS_TASK_SEASON: SeasonDefinition = {
  id: "vault_wars_s2",
  name: "Vault Wars",
  theme: "Hoard, flip, repeat",
  description: "Season tasks coming soon — vault-themed economy runs.",
  themeUi: {
    accent: "#f59e0b",
    accent2: "#ec4899",
    glow: "rgba(245, 158, 11, 0.4)",
    surface: "rgba(30, 20, 15, 0.55)",
  },
  tasks: [
    {
      id: "vw_daily_placeholder",
      title: "Vault Breach",
      description: "Placeholder daily — tune when season launches.",
      type: "daily",
      themeTag: "Vault",
      requirement: 1,
      metricKey: "placeholder_always_zero",
      reward: { xp: 10, savvyPoints: 5 },
    },
  ],
};

export const POWER_RUSH_TASK_SEASON: SeasonDefinition = {
  id: "power_rush_s3",
  name: "Power Rush",
  theme: "Multiplier madness",
  description: "Season tasks coming soon — pure power scaling.",
  themeUi: {
    accent: "#fbbf24",
    accent2: "#38bdf8",
    glow: "rgba(251, 191, 36, 0.5)",
    surface: "rgba(20, 15, 35, 0.55)",
  },
  tasks: [
    {
      id: "pr_daily_placeholder",
      title: "Overcharge",
      description: "Placeholder daily — tune when season launches.",
      type: "daily",
      themeTag: "Rush",
      requirement: 1,
      metricKey: "placeholder_always_zero",
      reward: { xp: 10, savvyPoints: 5 },
    },
  ],
};

export const SAVVY_ELITE_TASK_SEASON: SeasonDefinition = {
  id: "savvy_elite_s4",
  name: "Savvy Elite",
  theme: "Activity supremacy",
  description: "Season tasks coming soon — savvy and sync focused.",
  themeUi: {
    accent: "#34d399",
    accent2: "#818cf8",
    glow: "rgba(52, 211, 153, 0.45)",
    surface: "rgba(12, 30, 28, 0.55)",
  },
  tasks: [
    {
      id: "se_daily_placeholder",
      title: "Elite Sync",
      description: "Placeholder daily — tune when season launches.",
      type: "daily",
      themeTag: "Elite",
      requirement: 1,
      metricKey: "placeholder_always_zero",
      reward: { xp: 10, savvyPoints: 5 },
    },
  ],
};

const REGISTRY: Record<string, SeasonDefinition> = {
  [NEON_HUNT_TASK_SEASON.id]: NEON_HUNT_TASK_SEASON,
  [VAULT_WARS_TASK_SEASON.id]: VAULT_WARS_TASK_SEASON,
  [POWER_RUSH_TASK_SEASON.id]: POWER_RUSH_TASK_SEASON,
  [SAVVY_ELITE_TASK_SEASON.id]: SAVVY_ELITE_TASK_SEASON,
};

export function getSeasonTaskDefinition(seasonId: string): SeasonDefinition | null {
  return REGISTRY[seasonId] ?? null;
}

export function listSeasonTaskRegistrations(): SeasonDefinition[] {
  return Object.values(REGISTRY);
}
