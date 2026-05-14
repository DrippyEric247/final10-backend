/** Activity row in the profile feed */
export type ProfileActivityType =
  | "auction_win"
  | "savvy_points"
  | "streak"
  | "rank"
  | "season"
  | "vip"
  | "referral"
  | "power_boost";

export interface ProfileActivityFeedItem {
  id: string;
  type: ProfileActivityType;
  /** Emoji or short glyph */
  icon: string;
  title: string;
  detail: string;
  timestampMs: number;
  rewardLabel?: string;
}

export type UserGoalType =
  | "rank_chase"
  | "streak_protection"
  | "season_completion"
  | "task_completion"
  | "auction_milestone"
  | "vip_promotion"
  | "fallback";

export type RewardPreviewAccent = "gold" | "cyan" | "violet" | "emerald";

export interface RewardPreview {
  headline: string;
  detail?: string;
  accent: RewardPreviewAccent;
}

export interface UserGoal {
  id: string;
  goalType: UserGoalType;
  title: string;
  subtitle?: string;
  /** Current progress toward target (same units as target) */
  progressCurrent: number;
  progressTarget: number;
  /** e.g. "1,215 pts" or "2 tasks" */
  remainingLabel: string;
  reward: RewardPreview;
  ctaLabel: string;
  ctaActionId: string;
}

/** Inputs for picking the next best goal — from live profile + mocks */
export interface NextGoalInput {
  rivalDisplayName: string | null;
  pointsBehindRival: number | null;
  leaderboardRank: number;
  leaderboardScore: number;
  tasksCompleted: number;
  tasksTotal: number;
  streakWeeks: number;
  taskStreakWeeks: number;
  bpXp: number;
  bpMaxXp: number;
  bpCompletedTiers: number;
  bpTotalTiers: number;
  auctionsWon: number;
  /** Next auction-win badge threshold (e.g. 5) */
  auctionNextMilestoneAt: number;
  weeklyActivityScore: number;
  vipMaintainThreshold: number;
  vipPromoteThreshold: number;
  hasSilverRank: boolean;
  vipStatusMode: "locked" | "atRisk" | "unlocking" | "active";
}
