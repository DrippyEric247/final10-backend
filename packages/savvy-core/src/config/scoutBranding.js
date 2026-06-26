/**
 * Savvy Scout — Final10 AI assistant character branding.
 * User-facing copy for the trusted deal scout / market analyst persona.
 */

export const SAVVY_SCOUT = Object.freeze({
  name: "Savvy Scout",
  emoji: "🎯",
  title: "🎯 Savvy Scout",
  shortTitle: "Savvy Scout",
  ask: "🎯 Ask Savvy Scout",
  askPlaceholder: "Ask Savvy Scout…",
  notificationTitle: "🎯 Savvy Scout",
  detectedBy: "Detected by Savvy Scout",
  winLane: "🎯 Savvy Scout · Win Lane",
  scoutActive: "Scout Active",
  marketSweepActive: "Market Sweep Active",
  targetLocked: "Target Locked",
  monitoringMission: "Monitoring Mission",
  opportunityMission: "Opportunity Mission",
});

export const SCOUT_LABELS = Object.freeze({
  alert: "🎯 Savvy Scout Alert",
  foundThis: "🎯 Savvy Scout Found This",
  opportunity: "🎯 Savvy Scout Opportunity",
  recommendation: "🎯 Savvy Scout Recommendation",
  monitoring: "🎯 Savvy Scout Monitoring",
  search: "🎯 Savvy Scout Search",
  analysis: "🎯 Savvy Scout Analysis",
  confidence: "Savvy Scout confidence",
  confidenceTitle: "Savvy Scout Confidence",
  whyPicked: "Why Savvy Scout picked this:",
  whyPickedToggle: "🎯 Why Savvy Scout Picked This",
  summary: "⚡ Savvy Scout Summary",
  opportunities: "🎯 Savvy Scout Opportunities",
  recommendations: "🎯 Savvy Scout Recommendations",
  textAlert: "🎯 Savvy Scout Alert",
  voiceAlert: "🎯 Savvy Scout Voice Alert",
});

export const SCOUT_COPY = Object.freeze({
  dealCard: {
    opportunityWatching: "Savvy Scout found an opportunity worth watching.",
    lowCompetition: "Savvy Scout detected low competition.",
    actSoon: "Savvy Scout recommends acting soon.",
    undervalued: "Savvy Scout believes this listing is undervalued.",
    scoutActive: "Scout Active",
    monitoring: "Savvy Scout is watching this target.",
  },
  alerts: {
    watching: "Savvy Scout is watching this target.",
    targetLocked: "Target locked. Savvy Scout is monitoring the market.",
    categoryMovement: "Savvy Scout found movement in your tracked category.",
    sweepActive: "Market Sweep Active",
    monitoringPaused: "Monitoring paused",
    targetHit: "Target hit",
  },
  bestMove: {
    selected: "Savvy Scout selected this as your Best Move.",
    whyPicked: "Why Savvy Scout picked this:",
    confidenceHigh: "Savvy Scout confidence: High",
    confidenceMedium: "Savvy Scout confidence: Medium",
  },
  wallet: {
    trackedEarnings: "Savvy Scout tracked your earnings.",
    calculatedMultiplier: "Savvy Scout calculated your multiplier.",
    streakBonus: "Savvy Scout detected a streak bonus.",
    feedEmpty: "Savvy Scout is scanning for opportunities…",
  },
  empty: {
    scanning: "Savvy Scout is scanning for opportunities…",
    searchingLanes: "Savvy Scout is searching new lanes…",
    noneYet: "No opportunities found yet. Savvy Scout is still watching.",
  },
  assistant: {
    picksEyebrow: "✦ Savvy Scout's picks",
    monitoringBadge: "Monitoring Mission",
    coachEyebrow: "Savvy Scout",
    thinking: "Savvy Scout is thinking…",
  },
});

/** @param {keyof typeof SCOUT_LABELS} key */
export function scoutLabel(key) {
  return SCOUT_LABELS[key] || SAVVY_SCOUT.title;
}
