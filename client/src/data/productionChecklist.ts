export type ChecklistStatus = "not_started" | "in_progress" | "blocked" | "complete";
export type ChecklistPriority = "critical" | "high" | "medium" | "low";

export interface ChecklistItem {
  id: string;
  title: string;
  status: ChecklistStatus;
  priority?: ChecklistPriority;
  notes?: string;
  owner?: string;
  dependency?: string;
}

export interface ChecklistCategory {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export const PRODUCTION_CHECKLIST: ChecklistCategory[] = [
  {
    id: "backend_persistence",
    title: "Backend Persistence",
    items: [
      { id: "bp_users", title: "Persist user profiles", status: "in_progress", priority: "critical", owner: "Backend" },
      { id: "bp_progress", title: "Persist battle pass progress", status: "not_started", priority: "critical" },
      { id: "bp_rewards", title: "Persist rewards / unlocks", status: "not_started", priority: "high" },
      { id: "bp_cosmetics", title: "Persist equipped cosmetics", status: "not_started", priority: "high" },
      { id: "bp_leaderboard", title: "Persist leaderboard stats", status: "in_progress", priority: "high" },
      { id: "bp_premium", title: "Persist premium entitlements", status: "in_progress", priority: "critical" },
    ],
  },
  {
    id: "auth_security",
    title: "Auth & Security",
    items: [
      { id: "as_routes", title: "Protected routes coverage", status: "in_progress", priority: "critical" },
      { id: "as_tokens", title: "Token/session hardening", status: "in_progress", priority: "critical" },
      { id: "as_reset", title: "Password reset flow", status: "not_started", priority: "high" },
      { id: "as_rate", title: "Rate limiting verification", status: "complete", priority: "high" },
      { id: "as_authz", title: "Server-side authorization checks", status: "in_progress", priority: "critical" },
    ],
  },
  {
    id: "battle_pass_integrity",
    title: "Battle Pass Integrity",
    items: [
      { id: "bi_validate", title: "Server-side event validation", status: "not_started", priority: "critical" },
      { id: "bi_dupe", title: "Duplicate reward prevention", status: "in_progress", priority: "critical" },
      { id: "bi_tier", title: "Tier unlock correctness tests", status: "in_progress", priority: "high" },
      { id: "bi_premium_claim", title: "Premium reward claim logic", status: "in_progress", priority: "high" },
      { id: "bi_antispam", title: "Anti-spam / exploit controls", status: "blocked", priority: "critical", notes: "Needs server event gateway first", dependency: "bi_validate" },
    ],
  },
  {
    id: "ebay_integration",
    title: "eBay Integration",
    items: [
      { id: "ei_auction", title: "Live auction fetch", status: "in_progress", priority: "critical" },
      { id: "ei_buy", title: "Buy It Now fetch", status: "in_progress", priority: "high" },
      { id: "ei_norm", title: "Listing normalization", status: "in_progress", priority: "high" },
      { id: "ei_expired", title: "Expired listing handling", status: "not_started", priority: "high" },
      { id: "ei_fallback", title: "Error fallback behavior", status: "in_progress", priority: "high" },
      { id: "ei_oauth", title: "OAuth separation (app vs user)", status: "in_progress", priority: "critical" },
    ],
  },
  {
    id: "payments_premium",
    title: "Payments & Premium",
    items: [
      { id: "pp_sub", title: "Subscription flow", status: "in_progress", priority: "critical" },
      { id: "pp_enforce", title: "Premium access enforcement", status: "in_progress", priority: "critical" },
      { id: "pp_restore", title: "Restore purchases", status: "not_started", priority: "medium" },
      { id: "pp_webhooks", title: "Webhook handling", status: "blocked", priority: "critical", notes: "Provider event retries not finalized" },
      { id: "pp_cancel", title: "Downgrade / cancel logic", status: "in_progress", priority: "high" },
    ],
  },
  {
    id: "leaderboards_profiles",
    title: "Leaderboards & Profiles",
    items: [
      { id: "lp_truth", title: "Server-truth leaderboard data", status: "in_progress", priority: "critical" },
      { id: "lp_fair", title: "Fair score calculation", status: "in_progress", priority: "high" },
      { id: "lp_reset", title: "Season reset handling", status: "not_started", priority: "high" },
      { id: "lp_consistency", title: "Profile stat consistency", status: "not_started", priority: "high" },
    ],
  },
  {
    id: "ux_stability",
    title: "UX Stability",
    items: [
      { id: "ux_loading", title: "Loading states", status: "in_progress", priority: "medium" },
      { id: "ux_empty", title: "Empty states", status: "in_progress", priority: "medium" },
      { id: "ux_error", title: "Error states", status: "in_progress", priority: "high" },
      { id: "ux_retry", title: "Retry states", status: "not_started", priority: "medium" },
      { id: "ux_fallback", title: "Fallback image/data handling", status: "in_progress", priority: "medium" },
    ],
  },
  {
    id: "monitoring_analytics",
    title: "Monitoring & Analytics",
    items: [
      { id: "ma_crash", title: "Crash/error logging", status: "not_started", priority: "critical" },
      { id: "ma_api", title: "API error logging", status: "in_progress", priority: "high" },
      { id: "ma_funnel", title: "Funnel analytics", status: "not_started", priority: "medium" },
      { id: "ma_anomaly", title: "Reward anomaly logging", status: "not_started", priority: "high" },
    ],
  },
  {
    id: "admin_support",
    title: "Admin / Support",
    items: [
      { id: "ad_state", title: "Inspect user state", status: "in_progress", priority: "high" },
      { id: "ad_premium", title: "Inspect premium status", status: "in_progress", priority: "high" },
      { id: "ad_rewards", title: "Inspect rewards", status: "not_started", priority: "medium" },
      { id: "ad_manual", title: "Manual correction tools", status: "not_started", priority: "high" },
    ],
  },
  {
    id: "legal_launch",
    title: "Legal / Launch",
    items: [
      { id: "ll_privacy", title: "Privacy policy", status: "not_started", priority: "critical" },
      { id: "ll_terms", title: "Terms of service", status: "not_started", priority: "critical" },
      { id: "ll_support", title: "Support contact setup", status: "in_progress", priority: "medium" },
      { id: "ll_onboarding", title: "Onboarding readiness", status: "in_progress", priority: "high" },
      { id: "ll_store", title: "App store readiness", status: "not_started", priority: "medium" },
    ],
  },
];

