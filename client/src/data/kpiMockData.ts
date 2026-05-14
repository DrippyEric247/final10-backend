export type KpiTone = "good" | "warning" | "bad";
export type KpiPeriodKey = "today" | "7d" | "30d";

export interface KpiMetric {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  tone: KpiTone;
  deltaPct: number;
  decimals?: number;
}

export interface FunnelStep {
  id: string;
  label: string;
  users: number;
}

export interface KpiTrendPoint {
  label: string;
  value: number;
}

export interface LaunchKpiSnapshot {
  period: KpiPeriodKey;
  lastUpdatedIso: string;
  topRow: KpiMetric[];
  activation: KpiMetric[];
  engagement: KpiMetric[];
  retention: KpiMetric[];
  monetization: KpiMetric[];
  reliability: KpiMetric[];
  final10Specific: KpiMetric[];
  activationFunnel: FunnelStep[];
  monetizationFunnel: FunnelStep[];
  trends: {
    activationPct: KpiTrendPoint[];
    retentionD1Pct: KpiTrendPoint[];
    conversionPct: KpiTrendPoint[];
  };
}

export const KPI_MOCK_DATA: Record<KpiPeriodKey, LaunchKpiSnapshot> = {
  today: {
    period: "today",
    lastUpdatedIso: "2026-04-15T16:24:00.000Z",
    topRow: [
      { id: "top_activation", label: "Activation %", value: 43.2, suffix: "%", tone: "warning", deltaPct: 4.1, decimals: 1 },
      { id: "top_d1", label: "Day 1 Retention", value: 31.4, suffix: "%", tone: "warning", deltaPct: -1.9, decimals: 1 },
      { id: "top_tasks", label: "Tasks / User", value: 5.6, tone: "good", deltaPct: 7.8, decimals: 1 },
      { id: "top_conv", label: "Premium Conversion", value: 3.9, suffix: "%", tone: "warning", deltaPct: 0.8, decimals: 1 },
      { id: "top_crashfree", label: "Crash-Free Sessions", value: 99.2, suffix: "%", tone: "good", deltaPct: 0.2, decimals: 1 },
    ],
    activation: [
      { id: "a_scanner", label: "% users who open scanner", value: 61.7, suffix: "%", tone: "good", deltaPct: 3.2, decimals: 1 },
      { id: "a_listing", label: "% users who view listing", value: 54.1, suffix: "%", tone: "warning", deltaPct: 1.1, decimals: 1 },
      { id: "a_first_task", label: "% users who complete first task", value: 39.8, suffix: "%", tone: "warning", deltaPct: -0.5, decimals: 1 },
      { id: "a_first_tier", label: "% users who reach first tier up", value: 28.9, suffix: "%", tone: "warning", deltaPct: 2.4, decimals: 1 },
    ],
    engagement: [
      { id: "e_tasks", label: "tasks per user", value: 5.6, tone: "good", deltaPct: 7.8, decimals: 1 },
      { id: "e_scans", label: "scans per session", value: 3.4, tone: "good", deltaPct: 4.4, decimals: 1 },
      { id: "e_views", label: "listings viewed per session", value: 8.1, tone: "good", deltaPct: 6.6, decimals: 1 },
    ],
    retention: [
      { id: "r_d1", label: "day 1 retention", value: 31.4, suffix: "%", tone: "warning", deltaPct: -1.9, decimals: 1 },
      { id: "r_d3", label: "day 3 retention", value: 22.7, suffix: "%", tone: "warning", deltaPct: -1.2, decimals: 1 },
      { id: "r_d7", label: "day 7 retention", value: 15.2, suffix: "%", tone: "warning", deltaPct: 0.9, decimals: 1 },
      { id: "r_sessions", label: "average sessions per user", value: 4.7, tone: "good", deltaPct: 3.1, decimals: 1 },
    ],
    monetization: [
      { id: "m_views", label: "premium CTA views", value: 1840, tone: "good", deltaPct: 9.4 },
      { id: "m_clicks", label: "premium CTA clicks", value: 262, tone: "good", deltaPct: 5.5 },
      { id: "m_started", label: "checkout started", value: 113, tone: "warning", deltaPct: -2.0 },
      { id: "m_completed", label: "checkout completed", value: 72, tone: "warning", deltaPct: 1.3 },
      { id: "m_rate", label: "conversion rate", value: 3.9, suffix: "%", tone: "warning", deltaPct: 0.8, decimals: 1 },
    ],
    reliability: [
      { id: "rel_crash", label: "crash-free sessions %", value: 99.2, suffix: "%", tone: "good", deltaPct: 0.2, decimals: 1 },
      { id: "rel_api", label: "API error rate", value: 1.6, suffix: "%", tone: "warning", deltaPct: -0.3, decimals: 1 },
      { id: "rel_ebay", label: "eBay success rate", value: 93.8, suffix: "%", tone: "good", deltaPct: 1.4, decimals: 1 },
      { id: "rel_resp", label: "average response time", value: 482, suffix: "ms", tone: "warning", deltaPct: -6.5 },
    ],
    final10Specific: [
      { id: "f_best_move", label: "best move views", value: 970, tone: "good", deltaPct: 11.2 },
      { id: "f_usage_mix", label: "auction vs buy-now usage %", value: 68, suffix: "% auction", tone: "good", deltaPct: 2.7 },
      { id: "f_clickout", label: "listing click-out rate", value: 46.3, suffix: "%", tone: "good", deltaPct: 3.4, decimals: 1 },
    ],
    activationFunnel: [
      { id: "af_signin", label: "Signed-in users", users: 1000 },
      { id: "af_scanner", label: "Opened scanner", users: 617 },
      { id: "af_listing", label: "Viewed listing", users: 541 },
      { id: "af_task", label: "Completed first task", users: 398 },
      { id: "af_tier", label: "Reached first tier up", users: 289 },
    ],
    monetizationFunnel: [
      { id: "mf_cta_view", label: "Premium CTA views", users: 1840 },
      { id: "mf_cta_click", label: "CTA clicks", users: 262 },
      { id: "mf_checkout_start", label: "Checkout started", users: 113 },
      { id: "mf_checkout_done", label: "Checkout completed", users: 72 },
    ],
    trends: {
      activationPct: [
        { label: "09:00", value: 39.2 },
        { label: "11:00", value: 41.1 },
        { label: "13:00", value: 42.8 },
        { label: "15:00", value: 43.2 },
      ],
      retentionD1Pct: [
        { label: "09:00", value: 30.1 },
        { label: "11:00", value: 30.5 },
        { label: "13:00", value: 31.0 },
        { label: "15:00", value: 31.4 },
      ],
      conversionPct: [
        { label: "09:00", value: 3.2 },
        { label: "11:00", value: 3.6 },
        { label: "13:00", value: 3.8 },
        { label: "15:00", value: 3.9 },
      ],
    },
  },
  "7d": {
    period: "7d",
    lastUpdatedIso: "2026-04-15T16:24:00.000Z",
    topRow: [
      { id: "top_activation", label: "Activation %", value: 45.9, suffix: "%", tone: "good", deltaPct: 6.7, decimals: 1 },
      { id: "top_d1", label: "Day 1 Retention", value: 33.7, suffix: "%", tone: "good", deltaPct: 2.5, decimals: 1 },
      { id: "top_tasks", label: "Tasks / User", value: 5.2, tone: "good", deltaPct: 4.3, decimals: 1 },
      { id: "top_conv", label: "Premium Conversion", value: 4.2, suffix: "%", tone: "good", deltaPct: 1.5, decimals: 1 },
      { id: "top_crashfree", label: "Crash-Free Sessions", value: 99.4, suffix: "%", tone: "good", deltaPct: 0.4, decimals: 1 },
    ],
    activation: [
      { id: "a_scanner", label: "% users who open scanner", value: 64.4, suffix: "%", tone: "good", deltaPct: 4.9, decimals: 1 },
      { id: "a_listing", label: "% users who view listing", value: 57.3, suffix: "%", tone: "good", deltaPct: 3.8, decimals: 1 },
      { id: "a_first_task", label: "% users who complete first task", value: 42.2, suffix: "%", tone: "warning", deltaPct: 1.6, decimals: 1 },
      { id: "a_first_tier", label: "% users who reach first tier up", value: 30.1, suffix: "%", tone: "warning", deltaPct: 2.1, decimals: 1 },
    ],
    engagement: [
      { id: "e_tasks", label: "tasks per user", value: 5.2, tone: "good", deltaPct: 4.3, decimals: 1 },
      { id: "e_scans", label: "scans per session", value: 3.2, tone: "good", deltaPct: 2.6, decimals: 1 },
      { id: "e_views", label: "listings viewed per session", value: 7.8, tone: "good", deltaPct: 4.2, decimals: 1 },
    ],
    retention: [
      { id: "r_d1", label: "day 1 retention", value: 33.7, suffix: "%", tone: "good", deltaPct: 2.5, decimals: 1 },
      { id: "r_d3", label: "day 3 retention", value: 24.5, suffix: "%", tone: "warning", deltaPct: 1.4, decimals: 1 },
      { id: "r_d7", label: "day 7 retention", value: 16.8, suffix: "%", tone: "warning", deltaPct: 0.7, decimals: 1 },
      { id: "r_sessions", label: "average sessions per user", value: 4.4, tone: "good", deltaPct: 2.2, decimals: 1 },
    ],
    monetization: [
      { id: "m_views", label: "premium CTA views", value: 12060, tone: "good", deltaPct: 8.3 },
      { id: "m_clicks", label: "premium CTA clicks", value: 1824, tone: "good", deltaPct: 6.2 },
      { id: "m_started", label: "checkout started", value: 790, tone: "good", deltaPct: 3.9 },
      { id: "m_completed", label: "checkout completed", value: 507, tone: "good", deltaPct: 4.8 },
      { id: "m_rate", label: "conversion rate", value: 4.2, suffix: "%", tone: "good", deltaPct: 1.5, decimals: 1 },
    ],
    reliability: [
      { id: "rel_crash", label: "crash-free sessions %", value: 99.4, suffix: "%", tone: "good", deltaPct: 0.4, decimals: 1 },
      { id: "rel_api", label: "API error rate", value: 1.4, suffix: "%", tone: "good", deltaPct: -0.2, decimals: 1 },
      { id: "rel_ebay", label: "eBay success rate", value: 94.6, suffix: "%", tone: "good", deltaPct: 1.9, decimals: 1 },
      { id: "rel_resp", label: "average response time", value: 468, suffix: "ms", tone: "good", deltaPct: -5.7 },
    ],
    final10Specific: [
      { id: "f_best_move", label: "best move views", value: 6890, tone: "good", deltaPct: 9.2 },
      { id: "f_usage_mix", label: "auction vs buy-now usage %", value: 66, suffix: "% auction", tone: "good", deltaPct: 1.8 },
      { id: "f_clickout", label: "listing click-out rate", value: 44.8, suffix: "%", tone: "good", deltaPct: 2.2, decimals: 1 },
    ],
    activationFunnel: [
      { id: "af_signin", label: "Signed-in users", users: 6800 },
      { id: "af_scanner", label: "Opened scanner", users: 4379 },
      { id: "af_listing", label: "Viewed listing", users: 3896 },
      { id: "af_task", label: "Completed first task", users: 2870 },
      { id: "af_tier", label: "Reached first tier up", users: 2047 },
    ],
    monetizationFunnel: [
      { id: "mf_cta_view", label: "Premium CTA views", users: 12060 },
      { id: "mf_cta_click", label: "CTA clicks", users: 1824 },
      { id: "mf_checkout_start", label: "Checkout started", users: 790 },
      { id: "mf_checkout_done", label: "Checkout completed", users: 507 },
    ],
    trends: {
      activationPct: [
        { label: "Mon", value: 43.3 },
        { label: "Tue", value: 44.6 },
        { label: "Wed", value: 45.2 },
        { label: "Thu", value: 45.9 },
      ],
      retentionD1Pct: [
        { label: "Mon", value: 32.6 },
        { label: "Tue", value: 33.0 },
        { label: "Wed", value: 33.4 },
        { label: "Thu", value: 33.7 },
      ],
      conversionPct: [
        { label: "Mon", value: 3.8 },
        { label: "Tue", value: 4.0 },
        { label: "Wed", value: 4.1 },
        { label: "Thu", value: 4.2 },
      ],
    },
  },
  "30d": {
    period: "30d",
    lastUpdatedIso: "2026-04-15T16:24:00.000Z",
    topRow: [
      { id: "top_activation", label: "Activation %", value: 44.8, suffix: "%", tone: "warning", deltaPct: 3.8, decimals: 1 },
      { id: "top_d1", label: "Day 1 Retention", value: 32.9, suffix: "%", tone: "warning", deltaPct: 1.7, decimals: 1 },
      { id: "top_tasks", label: "Tasks / User", value: 5.0, tone: "good", deltaPct: 3.1, decimals: 1 },
      { id: "top_conv", label: "Premium Conversion", value: 4.0, suffix: "%", tone: "warning", deltaPct: 1.2, decimals: 1 },
      { id: "top_crashfree", label: "Crash-Free Sessions", value: 99.1, suffix: "%", tone: "good", deltaPct: 0.1, decimals: 1 },
    ],
    activation: [
      { id: "a_scanner", label: "% users who open scanner", value: 63.2, suffix: "%", tone: "good", deltaPct: 2.2, decimals: 1 },
      { id: "a_listing", label: "% users who view listing", value: 56.1, suffix: "%", tone: "warning", deltaPct: 2.1, decimals: 1 },
      { id: "a_first_task", label: "% users who complete first task", value: 40.6, suffix: "%", tone: "warning", deltaPct: 1.0, decimals: 1 },
      { id: "a_first_tier", label: "% users who reach first tier up", value: 29.7, suffix: "%", tone: "warning", deltaPct: 1.5, decimals: 1 },
    ],
    engagement: [
      { id: "e_tasks", label: "tasks per user", value: 5.0, tone: "good", deltaPct: 3.1, decimals: 1 },
      { id: "e_scans", label: "scans per session", value: 3.1, tone: "good", deltaPct: 1.7, decimals: 1 },
      { id: "e_views", label: "listings viewed per session", value: 7.5, tone: "good", deltaPct: 2.9, decimals: 1 },
    ],
    retention: [
      { id: "r_d1", label: "day 1 retention", value: 32.9, suffix: "%", tone: "warning", deltaPct: 1.7, decimals: 1 },
      { id: "r_d3", label: "day 3 retention", value: 23.8, suffix: "%", tone: "warning", deltaPct: 1.2, decimals: 1 },
      { id: "r_d7", label: "day 7 retention", value: 16.0, suffix: "%", tone: "warning", deltaPct: 0.5, decimals: 1 },
      { id: "r_sessions", label: "average sessions per user", value: 4.2, tone: "good", deltaPct: 1.6, decimals: 1 },
    ],
    monetization: [
      { id: "m_views", label: "premium CTA views", value: 48810, tone: "good", deltaPct: 5.9 },
      { id: "m_clicks", label: "premium CTA clicks", value: 7080, tone: "good", deltaPct: 4.9 },
      { id: "m_started", label: "checkout started", value: 3040, tone: "warning", deltaPct: 2.2 },
      { id: "m_completed", label: "checkout completed", value: 1934, tone: "warning", deltaPct: 2.5 },
      { id: "m_rate", label: "conversion rate", value: 4.0, suffix: "%", tone: "warning", deltaPct: 1.2, decimals: 1 },
    ],
    reliability: [
      { id: "rel_crash", label: "crash-free sessions %", value: 99.1, suffix: "%", tone: "good", deltaPct: 0.1, decimals: 1 },
      { id: "rel_api", label: "API error rate", value: 1.8, suffix: "%", tone: "warning", deltaPct: -0.1, decimals: 1 },
      { id: "rel_ebay", label: "eBay success rate", value: 92.9, suffix: "%", tone: "warning", deltaPct: 0.8, decimals: 1 },
      { id: "rel_resp", label: "average response time", value: 501, suffix: "ms", tone: "warning", deltaPct: -3.2 },
    ],
    final10Specific: [
      { id: "f_best_move", label: "best move views", value: 27020, tone: "good", deltaPct: 7.4 },
      { id: "f_usage_mix", label: "auction vs buy-now usage %", value: 65, suffix: "% auction", tone: "good", deltaPct: 1.0 },
      { id: "f_clickout", label: "listing click-out rate", value: 43.2, suffix: "%", tone: "warning", deltaPct: 1.1, decimals: 1 },
    ],
    activationFunnel: [
      { id: "af_signin", label: "Signed-in users", users: 28100 },
      { id: "af_scanner", label: "Opened scanner", users: 17759 },
      { id: "af_listing", label: "Viewed listing", users: 15764 },
      { id: "af_task", label: "Completed first task", users: 11409 },
      { id: "af_tier", label: "Reached first tier up", users: 8346 },
    ],
    monetizationFunnel: [
      { id: "mf_cta_view", label: "Premium CTA views", users: 48810 },
      { id: "mf_cta_click", label: "CTA clicks", users: 7080 },
      { id: "mf_checkout_start", label: "Checkout started", users: 3040 },
      { id: "mf_checkout_done", label: "Checkout completed", users: 1934 },
    ],
    trends: {
      activationPct: [
        { label: "W1", value: 42.5 },
        { label: "W2", value: 43.9 },
        { label: "W3", value: 44.1 },
        { label: "W4", value: 44.8 },
      ],
      retentionD1Pct: [
        { label: "W1", value: 31.8 },
        { label: "W2", value: 32.1 },
        { label: "W3", value: 32.4 },
        { label: "W4", value: 32.9 },
      ],
      conversionPct: [
        { label: "W1", value: 3.6 },
        { label: "W2", value: 3.8 },
        { label: "W3", value: 3.9 },
        { label: "W4", value: 4.0 },
      ],
    },
  },
};

