/**
 * Heuristic bug report classifier for the AI Bug Fixer pipeline.
 * Runs before GitHub issue creation so every report is immediately actionable.
 */

const PRIORITIES = Object.freeze({
  P0: Object.freeze({
    id: 'P0',
    label: '🔴 P0 – Launch Blocker',
    githubLabel: 'priority:p0',
    weight: 0,
  }),
  P1: Object.freeze({
    id: 'P1',
    label: '🟠 P1 – Critical',
    githubLabel: 'priority:p1',
    weight: 1,
  }),
  P2: Object.freeze({
    id: 'P2',
    label: '🟡 P2 – Normal',
    githubLabel: 'priority:p2',
    weight: 2,
  }),
  P3: Object.freeze({
    id: 'P3',
    label: '🔵 P3 – Nice to Have',
    githubLabel: 'priority:p3',
    weight: 3,
  }),
});

const APPS = Object.freeze({
  final10: Object.freeze({ id: 'final10', label: 'Final10', githubLabel: 'app:final10' }),
  savvytrip: Object.freeze({ id: 'savvytrip', label: 'SavvyTrip', githubLabel: 'app:savvytrip' }),
  bitesavvy: Object.freeze({ id: 'bitesavvy', label: 'BiteSavvy', githubLabel: 'app:bitesavvy' }),
  'ai-go': Object.freeze({ id: 'ai-go', label: 'AI-Go', githubLabel: 'app:ai-go' }),
  ezstay: Object.freeze({ id: 'ezstay', label: 'EZ Stay', githubLabel: 'app:ezstay' }),
  gamesavvy: Object.freeze({ id: 'gamesavvy', label: 'GameSavvy', githubLabel: 'app:gamesavvy' }),
  fitsavvy: Object.freeze({ id: 'fitsavvy', label: 'FitSavvy', githubLabel: 'app:fitsavvy' }),
  savvyshop: Object.freeze({ id: 'savvyshop', label: 'SavvyShop', githubLabel: 'app:savvyshop' }),
  'shared-platform': Object.freeze({
    id: 'shared-platform',
    label: 'Shared Platform',
    githubLabel: 'app:shared-platform',
  }),
});

const SUBSYSTEMS = Object.freeze([
  'auth',
  'alerts',
  'economy',
  'payments',
  'ui',
  'perks',
  'missions',
  'seller-trust',
  'stripe',
  'beta',
  'search',
  'profile',
  'notifications',
  'mobile',
  'performance',
  'security',
]);

const SUBSYSTEM_FILE_HINTS = Object.freeze({
  auth: [
    'server/routes/auth.js',
    'server/middleware/auth.js',
    'client/src/context/AuthContext.js',
    'client/src/pages/Login.js',
    'client/src/pages/Register.js',
  ],
  alerts: [
    'server/routes/alerts.js',
    'server/services/alertService.js',
    'client/src/pages/Alerts.js',
    'client/src/components/alerts/SavvyAlertButton.js',
  ],
  economy: [
    'server/services/savvyRewardService.js',
    'server/routes/points.js',
    'client/src/store/savvyStore.js',
    'client/src/lib/rewardEngine.js',
  ],
  payments: [
    'server/routes/payments.js',
    'server/routes/stripe.js',
    'client/src/config/donationConfig.js',
  ],
  ui: [
    'client/src/App.js',
    'client/src/styles/',
    'client/src/components/',
  ],
  perks: [
    'server/services/perkMachineService.js',
    'client/src/pages/PerkMachine.js',
    'client/src/pages/ScoutFlightGame.js',
  ],
  missions: [
    'client/src/lib/savvyScoutMissions.js',
    'client/src/pages/MissionLog.js',
    'client/src/pages/DailyStreak.js',
  ],
  'seller-trust': [
    'server/services/trustScoreService.js',
    'client/src/lib/trustScoreEngine.js',
  ],
  stripe: [
    'server/routes/stripe.js',
    'server/services/stripeService.js',
    'client/src/config/donationConfig.js',
  ],
  beta: [
    'server/services/betaTesterService.js',
    'client/src/pages/FoundingTesterMission.js',
    'client/src/lib/betaTesterAccess.js',
  ],
  search: [
    'client/src/components/search/GlobalSmartSearch.js',
    'client/src/lib/smartSearch.js',
    'client/src/pages/Auctions.js',
  ],
  profile: [
    'client/src/pages/Profile.js',
    'client/src/components/profile/SavvyBalanceCard.tsx',
  ],
  notifications: [
    'server/services/notificationService.js',
    'client/src/lib/assistantSignals.js',
  ],
  mobile: [
    'client/src/styles/',
    'client/src/components/wallet/SavvyWalletBubble.jsx',
    'client/src/components/auctions/AuctionsSavvyCompareModal.jsx',
  ],
  performance: [
    'server/index.js',
    'client/src/App.js',
  ],
  security: [
    'server/middleware/auth.js',
    'server/middleware/rateLimit.js',
  ],
});

const SUBSYSTEM_FIX_HINTS = Object.freeze({
  auth: 'Verify token/session handling, auth middleware order, and client AuthContext refresh paths.',
  alerts: 'Trace alert creation API, notification delivery, and UI alert button payload validation.',
  economy: 'Audit Savvy grant idempotency, balance sync, and reward service transaction boundaries.',
  payments: 'Confirm Stripe webhook handlers, payment link config, and checkout error surfaces.',
  ui: 'Inspect layout/CSS regressions, modal positioning, and responsive breakpoints.',
  perks: 'Check Perk Machine spin flow, Scout Flight state, and event inventory updates.',
  missions: 'Validate mission progress recording and streak/mission log persistence.',
  'seller-trust': 'Review trust score inputs, seller signals, and listing trust badge rendering.',
  stripe: 'Validate Stripe env vars, webhook signatures, and Payment Link success callbacks.',
  beta: 'Confirm beta tester gates, founding tester perks, and feedback bonus idempotency.',
  search: 'Inspect search intent filters, auction query params, and smart search ranking.',
  profile: 'Check profile data fetch, Savvy balance card, and deep-link hash scrolling.',
  notifications: 'Trace push/in-app notification pipeline and assistant signal throttling.',
  mobile: 'Test iOS Safari viewport, safe-area insets, scroll lock, and touch event handling.',
  performance: 'Profile slow API routes, large bundle imports, and redundant polling intervals.',
  security: 'Audit authz checks, input validation, rate limits, and secret exposure in logs.',
});

const SUBSYSTEM_REGRESSION_TESTS = Object.freeze({
  auth: [
    'Login/logout flow preserves session',
    'Protected routes reject missing/invalid tokens',
  ],
  alerts: [
    'Create alert from listing succeeds',
    'Alert list reflects new alert without refresh errors',
  ],
  economy: [
    'Savvy balance updates once per rewarded action (idempotent)',
    'Points API returns consistent balance after grant',
  ],
  payments: [
    'Donation/payment links resolve without 404',
    'Webhook handler rejects invalid signatures',
  ],
  ui: [
    'Affected page renders without console errors',
    'Modal/dialog is centered and dismissible on mobile',
  ],
  perks: [
    'Perk Machine spin deducts balance and records inventory',
    'Scout Flight run completes without state reset bugs',
  ],
  missions: [
    'Mission action increments progress once',
    'Daily streak state persists across reload',
  ],
  'seller-trust': [
    'Trust score displays for sample listing',
    'Low-trust listings surface warnings consistently',
  ],
  stripe: [
    'Stripe checkout session creation succeeds in test mode',
    'Payment success preview route loads',
  ],
  beta: [
    'Beta tester gate allows founding tester routes',
    'Quality feedback bonus grants at most once',
  ],
  search: [
    'Auction search returns results for known query',
    'Intent filters do not empty valid result sets',
  ],
  profile: [
    'Profile loads user Savvy balance',
    '/profile#savvy-balance scroll target works',
  ],
  notifications: [
    'Assistant signal fires without duplicate spam',
  ],
  mobile: [
    'Repro steps pass on mobile viewport (375px)',
    'No horizontal scroll or clipped controls',
  ],
  performance: [
    'Primary page load completes under acceptable threshold',
    'No runaway polling after navigation',
  ],
  security: [
    'Unauthorized API calls return 401/403',
    'Rate limit returns 429 under abuse simulation',
  ],
});

const APP_ROUTE_HINTS = Object.freeze([
  { app: 'gamesavvy', patterns: [/\/scout-flight/i, /scout flight/i, /gamesavvy/i] },
  { app: 'final10', patterns: [/\/perk-machine/i, /perk machine/i, /\/auctions/i, /\/alerts/i, /\/events/i, /\/battle-pass/i, /\/dashboard/i, /final10/i] },
  { app: 'savvyshop', patterns: [/\/shop\//i, /savvyshop/i, /\/savvy-shop/i] },
  { app: 'savvytrip', patterns: [/\/savvytrip/i, /savvy trip/i, /savvytrip/i] },
  { app: 'bitesavvy', patterns: [/\/bitesavvy/i, /bite savvy/i, /bitesavvy/i] },
  { app: 'ai-go', patterns: [/\/ai-go/i, /ai-go/i, /\bai go\b/i] },
  { app: 'ezstay', patterns: [/\/ez-?stay/i, /ez stay/i, /ezstay/i] },
  { app: 'fitsavvy', patterns: [/\/fitsavvy/i, /fit savvy/i, /fitsavvy/i] },
  { app: 'shared-platform', patterns: [/\/api\/auth/i, /\/login/i, /\/register/i, /shared platform/i, /cross-app/i] },
]);

const P0_KEYWORDS = [
  'launch blocker',
  'white screen',
  'blank screen',
  'cannot login',
  "can't login",
  'cannot log in',
  "can't log in",
  'app crash',
  'crashes on launch',
  'data loss',
  '500 error',
  'site down',
  'completely broken',
  'unable to access',
];

const P1_KEYWORDS = [
  'payment fail',
  'checkout fail',
  'stripe error',
  'security',
  'unauthorized',
  'password reset',
  'cannot bid',
  "can't bid",
  'cannot save',
  "can't save",
  'critical',
  'blocked',
];

const P3_KEYWORDS = [
  'typo',
  'cosmetic',
  'alignment',
  'color',
  'spacing',
  'nice to have',
  'minor visual',
  'wording',
  'copy tweak',
];

const SUBSYSTEM_KEYWORDS = Object.freeze({
  auth: ['login', 'logout', 'register', 'sign in', 'sign up', 'password', 'token', 'session', 'auth'],
  alerts: ['alert', 'watchlist alert', 'price alert', 'savvy alert'],
  economy: ['savvy point', 'savvy balance', 'reward', 'points', 'bonus', 'grant'],
  payments: ['payment', 'checkout', 'donation', 'subscribe', 'premium', 'billing'],
  ui: ['modal', 'button', 'layout', 'css', 'overlap', 'cut off', 'off-screen', 'display'],
  perks: ['perk machine', 'perk spin', 'scout flight', 'egg exchange', 'tournament ticket'],
  missions: ['mission', 'streak', 'daily streak', 'mission log'],
  'seller-trust': ['trust score', 'seller trust', 'trust badge', 'seller rating'],
  stripe: ['stripe', 'payment link', 'webhook'],
  beta: ['beta', 'founding tester', 'founding tester'],
  search: ['search', 'filter', 'query', 'smart search', 'intent', 'auctions', 'auction', 'browse'],
  profile: ['profile', 'settings', 'avatar', 'customization'],
  notifications: ['notification', 'push', 'toast', 'assistant signal', 'coach'],
  mobile: ['mobile', 'safari', 'ios', 'iphone', 'android', 'viewport', 'touch', 'responsive'],
  performance: ['slow', 'lag', 'timeout', 'loading forever', 'performance', 'freeze'],
  security: ['xss', 'csrf', 'injection', 'exposed', 'vulnerability', 'security'],
});

function normalizeText(parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).toLowerCase())
    .join('\n');
}

function scoreKeywordHits(text, keywords) {
  let score = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) score += kw.split(' ').length > 1 ? 2 : 1;
  }
  return score;
}

function classifyPriority({ severity, text }) {
  const p0 = scoreKeywordHits(text, P0_KEYWORDS);
  const p1 = scoreKeywordHits(text, P1_KEYWORDS);
  const p3 = scoreKeywordHits(text, P3_KEYWORDS);

  if (p0 >= 2 || (severity === 'high' && p0 >= 1)) return PRIORITIES.P0;
  if (p0 >= 1 || p1 >= 2 || severity === 'high') return PRIORITIES.P1;
  if (p3 >= 2 || severity === 'low') return PRIORITIES.P3;
  if (p1 >= 1 || severity === 'med') return PRIORITIES.P2;
  return PRIORITIES.P2;
}

function classifyApp({ page, text }) {
  const haystack = `${page || ''}\n${text}`;
  let best = { app: 'final10', score: 0 };

  for (const hint of APP_ROUTE_HINTS) {
    const appId = hint.app;
    if (!APPS[appId]) continue;
    let score = 0;
    for (const pattern of hint.patterns) {
      if (pattern.test(haystack)) score += 2;
    }
    if (score > best.score) best = { app: appId, score };
  }

  if (
    /\b(api|middleware|auth context|shared)\b/i.test(text) &&
    !/\/(auctions|alerts|events|perk)/i.test(page || '')
  ) {
    return APPS['shared-platform'];
  }

  return APPS[best.app] || APPS.final10;
}

function classifySubsystems(text) {
  const scored = SUBSYSTEMS.map((id) => ({
    id,
    score: scoreKeywordHits(text, SUBSYSTEM_KEYWORDS[id] || []),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return ['ui'];
  }

  const top = scored.slice(0, 4).map((s) => s.id);
  if (text.includes('mobile') || text.includes('safari') || text.includes('iphone')) {
    if (!top.includes('mobile')) top.push('mobile');
  }
  return [...new Set(top)];
}

function buildSummary({ title, subsystems, app, priority }) {
  const subs = subsystems.slice(0, 2).join(', ');
  return `${String(title || 'Untitled bug').trim()} — ${priority.label} in ${app.label} (${subs})`;
}

function buildRootCauseHypothesis({ subsystems, text, page }) {
  const primary = subsystems[0] || 'ui';
  const hints = {
    auth: 'Session/token validation or client auth state may be out of sync after navigation.',
    alerts: 'Alert payload validation or async alert pipeline may be failing silently.',
    economy: 'Reward grant path may lack idempotency or balance refresh after mutation.',
    payments: 'Stripe webhook or client payment link configuration may be misaligned.',
    ui: 'Recent UI/layout change may cause overflow, z-index, or scroll containment issues.',
    perks: 'Game or Perk Machine state machine may not reset cleanly between runs.',
    missions: 'Mission progress write may not persist or may double-count actions.',
    'seller-trust': 'Trust score inputs may be missing fields for this listing type.',
    stripe: 'Stripe env/config mismatch or webhook handler rejection is likely.',
    beta: 'Beta gate or one-time bonus flag may be blocking expected behavior.',
    search: 'Search intent filters may be over-narrowing results for this query.',
    profile: 'Profile section data fetch or hash navigation may be failing.',
    notifications: 'Notification throttle or assistant signal dedupe may suppress delivery.',
    mobile: 'Mobile Safari viewport/safe-area or scroll-lock handling is likely involved.',
    performance: 'Expensive re-render, polling loop, or unbounded API fetch may be the cause.',
    security: 'Missing authz check or insufficient input validation on the affected route.',
  };

  let hypothesis = hints[primary] || hints.ui;
  if (page) hypothesis += ` Page \`${page}\` is the primary surface.`;
  if (/\b(console|error|exception|failed to fetch)\b/i.test(text)) {
    hypothesis += ' Reporter mentioned console/network errors — inspect API response and client error boundaries.';
  }
  return hypothesis;
}

function buildSuggestedFix({ subsystems, app }) {
  const primary = subsystems[0] || 'ui';
  const fix = SUBSYSTEM_FIX_HINTS[primary] || SUBSYSTEM_FIX_HINTS.ui;
  return `${fix} Scope fix to ${app.label} and add regression coverage before merge.`;
}

function collectFilesLikelyInvolved(subsystems, page) {
  const files = new Set();
  for (const sub of subsystems) {
    for (const f of SUBSYSTEM_FILE_HINTS[sub] || []) files.add(f);
  }
  if (page) {
    const slug = String(page).replace(/^\//, '').split('/')[0];
    if (slug) {
      files.add(`client/src/pages/${slug.charAt(0).toUpperCase()}${slug.slice(1)}.js`);
    }
  }
  return [...files].slice(0, 12);
}

function collectRegressionTests(subsystems) {
  const tests = new Set(['Smoke: affected flow completes without console errors']);
  for (const sub of subsystems) {
    for (const t of SUBSYSTEM_REGRESSION_TESTS[sub] || []) tests.add(t);
  }
  return [...tests].slice(0, 8);
}

function buildGithubLabels({ priority, app, subsystems }) {
  return [
    'bug',
    'triage:ai',
    priority.githubLabel,
    app.githubLabel,
    ...subsystems,
  ];
}

function formatIssueBody(report, classification) {
  const {
    title,
    steps,
    expected,
    actual,
    severity,
    page,
    userAgent,
    timestamp,
    userId,
    username,
  } = report;

  const lines = [
    '## 🤖 AI Bug Fixer — Auto Classification',
    '',
    `**Priority:** ${classification.priority.label}`,
    `**Affected App:** ${classification.app.label} (\`${classification.app.id}\`)`,
    `**Subsystems:** ${classification.subsystems.map((s) => `\`${s}\``).join(', ')}`,
    `**Reporter Severity:** ${String(severity || 'med').toUpperCase()}`,
    '',
    '---',
    '',
    '## 📌 Summary',
    classification.summary,
    '',
    '## 📋 Steps to Reproduce',
    steps || '_not provided_',
    '',
    '## ✅ Expected Result',
    expected || '_not provided_',
    '',
    '## ❌ Actual Result',
    actual || '_not provided_',
    '',
    '## 🔬 Root Cause Hypothesis',
    classification.rootCauseHypothesis,
    '',
    '## 🛠 Suggested Fix',
    classification.suggestedFix,
    '',
    '## 📁 Files Likely Involved',
    ...classification.filesLikelyInvolved.map((f) => `- \`${f}\``),
    '',
    '## 🧪 Regression Tests Required',
    ...classification.regressionTests.map((t) => `- [ ] ${t}`),
    '',
    '---',
    '',
    '## 🧾 Reporter Context',
    `**Reported by:** ${username || 'Anonymous'} (User ID: ${userId || 'N/A'})`,
    `**Page:** \`${page || 'Unknown'}\``,
    `**Timestamp:** ${timestamp || new Date().toISOString()}`,
    `**User Agent:** \`${userAgent || 'Unknown'}\``,
    '',
    '## 🔧 AI Development Team',
    'This issue was auto-classified for the AI Bug Fixer. Use the hypothesis, file hints, and regression checklist above — no additional clarification required for triage.',
    '',
    '---',
    '*This bug report was automatically created from the Final10 application.*',
  ];

  return lines.join('\n');
}

/**
 * @param {object} report
 * @param {string} report.title
 * @param {string} report.steps
 * @param {string} [report.expected]
 * @param {string} [report.actual]
 * @param {string} [report.severity]
 * @param {string} [report.page]
 * @param {string} [report.userAgent]
 */
function classifyBugReport(report) {
  const text = normalizeText([
    report.title,
    report.steps,
    report.expected,
    report.actual,
    report.page,
    report.userAgent,
  ]);

  const priority = classifyPriority({ severity: report.severity, text });
  const app = classifyApp({ page: report.page, text });
  const subsystems = classifySubsystems(text);

  const classification = {
    priority,
    app,
    subsystems,
    summary: buildSummary({ title: report.title, subsystems, app, priority }),
    rootCauseHypothesis: buildRootCauseHypothesis({
      subsystems,
      text,
      page: report.page,
    }),
    suggestedFix: buildSuggestedFix({ subsystems, app }),
    filesLikelyInvolved: collectFilesLikelyInvolved(subsystems, report.page),
    regressionTests: collectRegressionTests(subsystems),
    githubLabels: buildGithubLabels({ priority, app, subsystems }),
  };

  return classification;
}

module.exports = {
  PRIORITIES,
  APPS,
  SUBSYSTEMS,
  classifyBugReport,
  formatIssueBody,
  buildGithubLabels,
};
