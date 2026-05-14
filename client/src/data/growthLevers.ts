export type GrowthLeverCategory =
  | "onboarding"
  | "engagement"
  | "monetization"
  | "reliability";

export type LeverPriority = "high" | "medium" | "low";
export type LeverImpact = "high" | "medium" | "low";

export interface GrowthLever {
  id: string;
  title: string;
  description: string;
  category: GrowthLeverCategory;
  priority: LeverPriority;
  estimatedImpact: LeverImpact;
}

export interface KpiGrowthConfig {
  id: string;
  name: string;
  thresholdGood: number;
  thresholdWarning: number;
  thresholdBad: number;
  description: string;
  simpleExplanation: string;
  recommendedLeverIds: string[];
}

export const GROWTH_LEVERS: GrowthLever[] = [
  {
    id: "lever_ftue_reward_preview",
    title: "Front-load first reward preview",
    description: "Show first unlock reward in onboarding and scanner entry to increase first action intent.",
    category: "onboarding",
    priority: "high",
    estimatedImpact: "high",
  },
  {
    id: "lever_scanner_entry_cta",
    title: "Boost scanner entry CTA visibility",
    description: "Increase scanner CTA prominence on home/feed and add a one-tap scanner shortcut.",
    category: "onboarding",
    priority: "high",
    estimatedImpact: "high",
  },
  {
    id: "lever_first_task_nudge",
    title: "Guide users to first task completion",
    description: "Use contextual prompts that highlight the fastest first task and expected reward.",
    category: "engagement",
    priority: "high",
    estimatedImpact: "high",
  },
  {
    id: "lever_day1_reactivation",
    title: "Add Day-1 reactivation loop",
    description: "Trigger reminder + streak incentive for users who churn within 24 hours.",
    category: "engagement",
    priority: "high",
    estimatedImpact: "high",
  },
  {
    id: "lever_task_difficulty_tuning",
    title: "Tune early task difficulty",
    description: "Reduce effort for first 3 tasks and improve early completion confidence.",
    category: "engagement",
    priority: "medium",
    estimatedImpact: "medium",
  },
  {
    id: "lever_premium_value_copy",
    title: "Strengthen premium value messaging",
    description: "Clarify premium benefits and show locked rewards users can unlock now.",
    category: "monetization",
    priority: "high",
    estimatedImpact: "high",
  },
  {
    id: "lever_checkout_friction",
    title: "Reduce checkout friction",
    description: "Shorten checkout path and prefill known profile fields to cut drop-off.",
    category: "monetization",
    priority: "high",
    estimatedImpact: "high",
  },
  {
    id: "lever_retarget_non_converters",
    title: "Retarget premium non-converters",
    description: "Nudge users who clicked CTA but did not complete checkout with return incentives.",
    category: "monetization",
    priority: "medium",
    estimatedImpact: "medium",
  },
  {
    id: "lever_api_error_burn_down",
    title: "Burn down top API error buckets",
    description: "Prioritize the highest-volume API failure codes and improve fallback behavior.",
    category: "reliability",
    priority: "high",
    estimatedImpact: "high",
  },
  {
    id: "lever_ebay_retry_path",
    title: "Improve eBay retry resilience",
    description: "Add safer retry/backoff path and clearer fallback state for provider failures.",
    category: "reliability",
    priority: "medium",
    estimatedImpact: "medium",
  },
  {
    id: "lever_client_crash_guardrails",
    title: "Add crash guardrails in key flows",
    description: "Harden scanner/listing screens with stricter null checks and error boundaries.",
    category: "reliability",
    priority: "high",
    estimatedImpact: "medium",
  },
];

export const KPI_GROWTH_CONFIG: KpiGrowthConfig[] = [
  {
    id: "activation_rate",
    name: "Activation Rate",
    thresholdGood: 50,
    thresholdWarning: 35,
    thresholdBad: 0,
    description: "% of users who reach activation milestones (scanner, listing, first action).",
    simpleExplanation: "Users are not reaching first reward.",
    recommendedLeverIds: [
      "lever_ftue_reward_preview",
      "lever_scanner_entry_cta",
      "lever_first_task_nudge",
      "lever_task_difficulty_tuning",
    ],
  },
  {
    id: "day1_retention",
    name: "Day 1 Retention",
    thresholdGood: 35,
    thresholdWarning: 25,
    thresholdBad: 0,
    description: "% of users returning the next day after signup.",
    simpleExplanation: "Retention is dropping after Day 1.",
    recommendedLeverIds: [
      "lever_day1_reactivation",
      "lever_first_task_nudge",
      "lever_task_difficulty_tuning",
    ],
  },
  {
    id: "tasks_per_user",
    name: "Tasks Per User",
    thresholdGood: 5.5,
    thresholdWarning: 4.0,
    thresholdBad: 0,
    description: "Average task completions per active user.",
    simpleExplanation: "Users are not progressing deeply enough.",
    recommendedLeverIds: [
      "lever_first_task_nudge",
      "lever_task_difficulty_tuning",
      "lever_day1_reactivation",
    ],
  },
  {
    id: "premium_conversion",
    name: "Premium Conversion",
    thresholdGood: 5,
    thresholdWarning: 3,
    thresholdBad: 0,
    description: "% of users converting to premium from CTA/checkout funnel.",
    simpleExplanation: "Monetization funnel is leaking before checkout completion.",
    recommendedLeverIds: [
      "lever_premium_value_copy",
      "lever_checkout_friction",
      "lever_retarget_non_converters",
    ],
  },
  {
    id: "crash_free_sessions",
    name: "Crash-Free Sessions",
    thresholdGood: 99.5,
    thresholdWarning: 98.8,
    thresholdBad: 0,
    description: "% of sessions completed without app crash.",
    simpleExplanation: "Reliability issues are hurting trust and repeat usage.",
    recommendedLeverIds: [
      "lever_client_crash_guardrails",
      "lever_api_error_burn_down",
      "lever_ebay_retry_path",
    ],
  },
];

export const KPI_CURRENT_VALUES: Record<string, number> = {
  activation_rate: 31.8,
  day1_retention: 21.6,
  tasks_per_user: 4.3,
  premium_conversion: 2.2,
  crash_free_sessions: 99.1,
};

