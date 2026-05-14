export type SmartCoachPriority = "low" | "medium" | "high";
export type SmartCoachPresentation = "banner" | "modal";
export type SmartCoachTriggerId =
  | "no_scanning"
  | "no_task_completion"
  | "points_no_engagement"
  | "near_tier_up"
  | "premium_exposure";

export interface SmartCoachMessageConfig {
  id: string;
  triggerId: SmartCoachTriggerId;
  message: string;
  title: string;
  priority: SmartCoachPriority;
  cooldownMs: number;
  maxFrequency: number;
  presentation: SmartCoachPresentation;
  ctaLabel?: string;
  ctaAction?: "scanner" | "tasks" | "premium" | "continue";
}

export interface SmartCoachBehaviorState {
  activeMs: number;
  listingsViewed: number;
  scansPerformed: number;
  tasksCompleted: number;
  pointsEarned: number;
  tierProgressPct: number;
  premiumViews: number;
  premiumClicks: number;
  lastActivityAt: number;
}

export const SMART_COACH_MESSAGE_CONFIG: SmartCoachMessageConfig[] = [
  {
    id: "coach-no-scan",
    triggerId: "no_scanning",
    title: "Quick win: run your first scan",
    message: "A single scan usually unlocks your fastest next reward step.",
    priority: "medium",
    cooldownMs: 10 * 60 * 1000,
    maxFrequency: 2,
    presentation: "banner",
    ctaLabel: "Open scanner",
    ctaAction: "scanner",
  },
  {
    id: "coach-no-task-progress",
    triggerId: "no_task_completion",
    title: "You are close to early momentum",
    message: "Users who finish one task usually progress faster through first tiers.",
    priority: "medium",
    cooldownMs: 15 * 60 * 1000,
    maxFrequency: 2,
    presentation: "banner",
    ctaLabel: "View tasks",
    ctaAction: "tasks",
  },
  {
    id: "coach-savvy-ecosystem",
    triggerId: "points_no_engagement",
    title: "Your Savvy points keep compounding",
    message:
      "You are building Savvy points that carry across the ecosystem. Points you earn here can be used in future Savvy apps.",
    priority: "low",
    cooldownMs: 20 * 60 * 1000,
    maxFrequency: 2,
    presentation: "banner",
    ctaLabel: "Keep going",
    ctaAction: "continue",
  },
  {
    id: "coach-near-tier-up",
    triggerId: "near_tier_up",
    title: "You are near a tier-up reward",
    message: "You are above 80% progress. One focused action can unlock your next tier.",
    priority: "high",
    cooldownMs: 20 * 60 * 1000,
    maxFrequency: 2,
    presentation: "modal",
    ctaLabel: "Continue progress",
    ctaAction: "tasks",
  },
  {
    id: "coach-premium-exposure",
    triggerId: "premium_exposure",
    title: "See what premium unlocks next",
    message: "You viewed premium rewards. One tap shows what unlocks immediately at your current progress.",
    priority: "medium",
    cooldownMs: 30 * 60 * 1000,
    maxFrequency: 2,
    presentation: "banner",
    ctaLabel: "Review premium",
    ctaAction: "premium",
  },
];

