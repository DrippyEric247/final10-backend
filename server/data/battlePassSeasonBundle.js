/**
 * Season task definitions + progress rules (mirrors client Neon Hunt S1).
 */

const NEON_HUNT_TASK_SEASON = {
  id: 'neon_hunt_s1',
  name: 'Neon Hunt',
  theme: 'Fast, clutch, competitive',
  description:
    'Chase ending-soon deals, strike in the final minutes, and stack power for the leaderboard climb.',
  tasks: [
    {
      id: 'nh_daily_scan_grid',
      title: 'Scan the Grid',
      description: 'Check 3 auctions ending soon.',
      type: 'daily',
      themeTag: 'Neon Snipe',
      requirement: 3,
      metricKey: 'scan_ending_soon',
      reward: { xp: 25, savvyPoints: 15, bonus: { kind: 'power_lint', value: 0.005, label: '+0.005× power lint' } },
    },
    {
      id: 'nh_daily_quick_trigger',
      title: 'Quick Trigger',
      description: 'Place 1 bid in the final 10 minutes of an auction.',
      type: 'daily',
      themeTag: 'Clutch',
      requirement: 1,
      metricKey: 'bid_final_ten',
      reward: { xp: 35, savvyPoints: 20 },
    },
    {
      id: 'nh_daily_power_charge',
      title: 'Power Charge',
      description: 'Claim your daily power boost.',
      type: 'daily',
      themeTag: 'Power Build',
      requirement: 1,
      metricKey: 'daily_power_claimed',
      reward: { xp: 15, savvyPoints: 10 },
    },
    {
      id: 'nh_weekly_auction_hunter',
      title: 'Auction Hunter',
      description: 'Win 3 auctions this week.',
      type: 'weekly',
      themeTag: 'Neon Snipe',
      requirement: 3,
      metricKey: 'auction_wins_week',
      reward: { xp: 120, savvyPoints: 80, bonus: { kind: 'power_lint', value: 0.01, label: '+0.01× power lint' } },
    },
    {
      id: 'nh_weekly_momentum',
      title: 'Momentum Builder',
      description: 'Earn 1,500 savvy points (weekly activity).',
      type: 'weekly',
      themeTag: 'Savvy',
      requirement: 1500,
      metricKey: 'savvy_points_week',
      reward: { xp: 90, savvyPoints: 50 },
    },
    {
      id: 'nh_weekly_locked_in',
      title: 'Stay Locked In',
      description: 'Maintain a 3-day streak (bundle or task).',
      type: 'weekly',
      themeTag: 'Power Build',
      requirement: 3,
      metricKey: 'streak_days_best',
      reward: { xp: 75, savvyPoints: 40 },
    },
    {
      id: 'nh_season_neon_snipe',
      title: 'Neon Snipe',
      description: 'Win an auction with under 10 seconds remaining.',
      type: 'season',
      themeTag: 'Neon Snipe',
      requirement: 1,
      metricKey: 'neon_snipe_win',
      reward: { xp: 200, savvyPoints: 100, bonus: { kind: 'label', label: 'Neon Snipe flair' } },
    },
    {
      id: 'nh_season_climb',
      title: 'Climb the Ranks',
      description: 'Move up 10 leaderboard spots vs your season start anchor.',
      type: 'season',
      themeTag: 'Competitive',
      requirement: 10,
      metricKey: 'rank_gain_season',
      reward: { xp: 150, savvyPoints: 60 },
    },
    {
      id: 'nh_season_power_surge',
      title: 'Power Surge',
      description: 'Reach at least 1.5× power multiplier.',
      type: 'season',
      themeTag: 'Power Build',
      requirement: 1,
      metricKey: 'power_multiplier_threshold',
      reward: { xp: 100, savvyPoints: 45 },
    },
    {
      id: 'nh_season_full_override',
      title: 'Full System Override',
      description: 'Complete 10 total missions (daily or weekly) this season.',
      type: 'season',
      themeTag: 'Override',
      requirement: 10,
      metricKey: 'season_missions_completed_tally',
      reward: { xp: 250, savvyPoints: 120, bonus: { kind: 'power_lint', value: 0.02, label: '+0.02× power lint' } },
    },
  ],
};

const NEON_HUNT_PROGRESS_RULES_BY_TASK_ID = {
  nh_daily_scan_grid: {
    kind: 'count',
    actionTypes: ['auction_scanned'],
    endingSoonSecondsMax: 600,
  },
  nh_daily_quick_trigger: {
    kind: 'count',
    actionTypes: ['bid_placed'],
    secondsRemainingAtMost: 600,
  },
  nh_daily_power_charge: {
    kind: 'count',
    actionTypes: ['power_boost_claimed', 'daily_login_claimed'],
  },
  nh_weekly_auction_hunter: {
    kind: 'count',
    actionTypes: ['auction_won'],
  },
  nh_weekly_momentum: {
    kind: 'accumulate',
    actionTypes: ['savvy_points_earned'],
  },
  nh_weekly_locked_in: {
    kind: 'threshold',
    actionTypes: ['streak_updated'],
  },
  nh_season_neon_snipe: {
    kind: 'count',
    actionTypes: ['auction_won'],
    secondsRemainingAtMost: 10,
  },
  nh_season_climb: {
    kind: 'accumulate',
    actionTypes: ['rank_changed'],
  },
  nh_season_power_surge: {
    kind: 'threshold',
    actionTypes: ['power_multiplier_changed'],
    multiplierAtLeast: 1.5,
  },
  nh_season_full_override: {
    kind: 'count',
    actionTypes: ['task_completed'],
    sourceTaskTypes: ['daily', 'weekly'],
    ignoreCompletedTaskIds: ['nh_season_full_override'],
  },
};

const IDLE_TASK_PROGRESS_RULE = {
  kind: 'count',
  actionTypes: [],
};

const REGISTRY = {
  neon_hunt_s1: NEON_HUNT_TASK_SEASON,
};

function resolveProgressRulesForSeason(season) {
  const base = season.id === 'neon_hunt_s1' ? NEON_HUNT_PROGRESS_RULES_BY_TASK_ID : {};
  const out = {};
  for (const t of season.tasks) {
    out[t.id] = base[t.id] || IDLE_TASK_PROGRESS_RULE;
  }
  return out;
}

function getSeasonTaskDefinition(seasonId) {
  return REGISTRY[seasonId] || null;
}

module.exports = {
  NEON_HUNT_TASK_SEASON,
  getSeasonTaskDefinition,
  resolveProgressRulesForSeason,
};
