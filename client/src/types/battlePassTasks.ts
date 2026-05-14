/** Context passed into metric resolvers (season-agnostic). */
export interface TaskResolverContext {
  localYmd: string;
  weekKey: string;
  authUser: {
    id?: string | number;
    username?: string;
    firstName?: string;
    email?: string;
  } | null;
  /** Leaderboard rank anchor captured at first task sync of the season */
  seasonRankAnchor: number | null;
  /** Auction win count snapshot at weekly period start */
  weekStartAuctionWins: number;
  /** Count of daily/weekly mission completions this season (for Full System Override) */
  seasonMissionTally: number;
}

/** Aligns with battle pass season id (e.g. neon_hunt_s1). */
export type SeasonId = string;

export type TaskType = "daily" | "weekly" | "season";

/** Optional extras granted when a mission completes (beyond xp / savvyPoints). */
export interface TaskBonusReward {
  kind: "power_lint" | "badge" | "cosmetic" | "label";
  /** Power lint delta (season multiplier bump) */
  value?: number;
  /** Cosmetic / badge id for unlock systems */
  id?: string;
  /** Display only */
  label?: string;
}

export interface TaskReward {
  xp: number;
  savvyPoints: number;
  bonus?: TaskBonusReward;
}

export interface BattlePassTaskDefinition {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  themeTag: string;
  /** Target amount for progress (count or threshold). */
  requirement: number;
  /**
   * Key resolved by `battlePassTaskResolvers` — keep season-agnostic.
   * New seasons add new keys in the resolver map only.
   */
  metricKey: string;
  reward: TaskReward;
}

/** Visual + copy for a themed season (drives CSS variables, not hardcoded in UI). */
export interface SeasonThemeUi {
  /** Primary accent (neon, gold, etc.) */
  accent: string;
  accent2: string;
  glow: string;
  surface: string;
}

export interface SeasonDefinition {
  id: SeasonId;
  name: string;
  theme: string;
  description: string;
  themeUi: SeasonThemeUi;
  tasks: BattlePassTaskDefinition[];
}

/** Runtime task row shown in UI (definition + state). */
export interface BattlePassTaskViewModel extends BattlePassTaskDefinition {
  progress: number;
  completed: boolean;
}
