/** Planned membership comparison — beta preview, subject to change. */

export const MEMBERSHIP_TABLE_ROWS = [
  { feature: 'AI Best Moves', free: '✅ Great Deals', premium: '⭐ Better Ranked', pro: '👑 Elite Ranked' },
  { feature: 'Daily Best Moves', free: '5', premium: 'More', pro: 'Unlimited' },
  { feature: 'Alert Speed', free: 'Standard', premium: 'Faster', pro: 'Fastest' },
  { feature: 'Scan Frequency', free: 'Standard', premium: 'Increased', pro: 'Maximum' },
  { feature: 'AI Explanations', free: 'Basic', premium: 'Enhanced', pro: 'Advanced' },
  { feature: 'Competition Analysis', free: 'Basic', premium: 'Enhanced', pro: 'Elite' },
  { feature: 'Seller Trust Analysis', free: 'Standard', premium: 'Enhanced', pro: 'Advanced' },
  { feature: 'Market Trend Analysis', free: '—', premium: 'Basic', pro: 'Advanced' },
  { feature: 'Lowest Competition Priority', free: '—', premium: 'Partial', pro: 'Highest Priority' },
  { feature: 'AI Processing Priority', free: 'Standard', premium: 'Higher', pro: 'Highest' },
];

export const MEMBERSHIP_TIER_PHILOSOPHY = [
  {
    id: 'free',
    emoji: '🟢',
    title: 'Free — Great Deals',
    body: 'Final10 helps you discover quality opportunities with AI-powered recommendations.',
    tone: 'free',
  },
  {
    id: 'premium',
    emoji: '🟣',
    title: 'Premium — Smarter & Faster',
    body: 'Receive better-ranked opportunities sooner with enhanced AI insights and faster scans.',
    tone: 'premium',
  },
  {
    id: 'pro',
    emoji: '🟡',
    title: 'Pro — Elite Hunter',
    body: "Get Final10's highest-confidence opportunities first with maximum scan frequency, earliest alerts, and advanced market intelligence.",
    tone: 'pro',
  },
];

export const MEMBERSHIP_CLOSING_LINES = [
  'Free finds great deals.',
  'Premium finds better opportunities sooner.',
  'Pro finds the best opportunities first.',
];

export const MEMBERSHIP_SCOUT_LINES = [
  'Operator — your membership feedback defines what launches on day one.',
  'Compare the tiers, test everything, and tell us what earns your upgrade.',
  'Founding Testers help us price fairness before the public sees it.',
];
