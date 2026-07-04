/** Founding Tester Program — 7-day gated missions (beta). */

const MISSION_COUNT = 7;
const FEEDBACK_MIN_CHARS = 100;
const GRAND_REWARD_SAVVY = 2500;
const PRO_REWARD_DAYS = 30;

const MISSIONS = [
  {
    id: 'mission_1_search',
    order: 1,
    emoji: '🔍',
    title: 'Search Mission',
    taskLabel: 'Run a search or hunt for deals',
    taskDescription: 'Use Final10 to search for used deals, auctions, or opportunities.',
    path: '/local-deals',
    taskType: 'search',
    savvyReward: 120,
    xpReward: 45,
    questions: [
      'How easy was it to find what you wanted?',
      'What would you improve?',
    ],
  },
  {
    id: 'mission_2_alerts',
    order: 2,
    emoji: '🔔',
    title: 'Alerts Mission',
    taskLabel: 'Create or review your alerts',
    taskDescription: 'Set up an alert so Savvy Scout can watch the market for you.',
    path: '/alerts',
    taskType: 'alerts',
    savvyReward: 140,
    xpReward: 50,
    questions: [
      'Did the alerts make sense?',
      'Were they fast enough?',
      'Anything confusing?',
    ],
  },
  {
    id: 'mission_3_best_move',
    order: 3,
    emoji: '👑',
    title: 'Best Move Mission',
    taskLabel: 'Review a Best Move recommendation',
    taskDescription: 'Open a Best Move and see why Savvy Scout ranked it.',
    path: '/',
    taskType: 'best_move',
    savvyReward: 160,
    xpReward: 55,
    questions: [
      'Did you understand why Savvy Scout selected this deal?',
      'What information would you like added?',
    ],
  },
  {
    id: 'mission_4_perk_machine',
    order: 4,
    emoji: '🎰',
    title: 'Perk Machine Mission',
    taskLabel: 'Spin the Perk Machine',
    taskDescription: 'Try the Perk Machine and see what rewards you unlock.',
    path: '/perk-machine',
    taskType: 'perk_machine',
    savvyReward: 180,
    xpReward: 60,
    questions: [
      'Were the rewards exciting?',
      'Which perks would you like to see?',
    ],
  },
  {
    id: 'mission_5_profile',
    order: 5,
    emoji: '👤',
    title: 'Profile Mission',
    taskLabel: 'Explore your profile and progress',
    taskDescription: 'Review your Savvy progress, rank, and rewards on your profile.',
    path: '/profile',
    taskType: 'profile',
    savvyReward: 200,
    xpReward: 65,
    questions: [
      'Was your progress easy to understand?',
      'Anything confusing?',
    ],
  },
  {
    id: 'mission_6_events',
    order: 6,
    emoji: '⚡',
    title: 'Events Mission',
    taskLabel: 'Check live Savvy events',
    taskDescription: 'Visit Events and explore Double Points, Savvy Sale, or Max Supply Drop.',
    path: '/events',
    taskType: 'events',
    savvyReward: 220,
    xpReward: 70,
    questions: [
      'Did Double Points, Triple Points, Savvy Sale, or Max Supply Drop feel exciting?',
      'What would make them even better?',
    ],
  },
  {
    id: 'mission_7_overall',
    order: 7,
    emoji: '🏆',
    title: 'Overall Mission',
    taskLabel: 'Reflect on your beta experience',
    taskDescription: 'Share your honest take now that you have tested the core lanes.',
    path: '/founding-tester',
    taskType: 'overall',
    savvyReward: 280,
    xpReward: 80,
    questions: [
      'What feature impressed you most?',
      'What almost made you stop using Final10?',
      'If you could add one feature before launch, what would it be?',
    ],
  },
];

const GRAND_REWARD = {
  savvy: GRAND_REWARD_SAVVY,
  proDays: PRO_REWARD_DAYS,
  badge: 'founding_tester_completed',
  emblemId: 'sigil_founding_tester',
  callingCardId: 'card_founding_tester',
  title: 'Founding Tester Completed',
  scoutLine: 'Outstanding work, Operator. Your feedback helped shape the future of Final10.',
  legacyLine: "You weren't just an early user—you helped shape Final10 before the world saw it.",
};

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function msUntilNextUtcDay(now = new Date()) {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(0, next.getTime() - now.getTime());
}

function getMissionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

module.exports = {
  MISSIONS,
  MISSION_COUNT,
  FEEDBACK_MIN_CHARS,
  GRAND_REWARD,
  GRAND_REWARD_SAVVY,
  PRO_REWARD_DAYS,
  utcDayKey,
  msUntilNextUtcDay,
  getMissionById,
};
