/**
 * Profile XP — server source of truth for grants, recap triggers, and milestones.
 * Savvy Points and Profile XP remain separate currencies.
 */

const XP_SOURCES = Object.freeze({
  ALERT_CREATED: 'alert_created',
  ALERT_CLICKED: 'alert_clicked',
  BEST_MOVE_USED: 'best_move_used',
  AUCTION_WON: 'auction_won',
  PURCHASE_COMPLETED: 'purchase_completed',
  REFERRAL_COMPLETED: 'referral_completed',
  SCOUT_FLIGHT_RUN: 'scout_flight_run',
  SCOUT_FLIGHT_RANK: 'scout_flight_rank',
  CONTRACT_COMPLETED: 'contract_completed',
  FOUNDING_TESTER_COMPLETED: 'founding_tester_completed',
  EVENT_PARTICIPATION: 'event_participation',
  BATTLE_PASS_MILESTONE: 'battle_pass_milestone',
  STREAK_MILESTONE: 'streak_milestone',
  CALLING_CARD_UNLOCKED: 'calling_card_unlocked',
  EGG_COLLECTED: 'egg_collected',
  ADMIN_GRANT: 'admin_grant',
  TASK_COMPLETION: 'task_completion',
  DAILY_LOGIN: 'daily_login',
  SUPPLY_DROP: 'supply_drop',
});

/** Default XP amounts by source (admin-tunable). */
const XP_AMOUNTS = Object.freeze({
  [XP_SOURCES.ALERT_CREATED]: 15,
  [XP_SOURCES.ALERT_CLICKED]: 10,
  [XP_SOURCES.BEST_MOVE_USED]: 20,
  [XP_SOURCES.AUCTION_WON]: 35,
  [XP_SOURCES.PURCHASE_COMPLETED]: 25,
  [XP_SOURCES.REFERRAL_COMPLETED]: 40,
  [XP_SOURCES.SCOUT_FLIGHT_RUN]: 30,
  [XP_SOURCES.SCOUT_FLIGHT_RANK]: 50,
  [XP_SOURCES.CONTRACT_COMPLETED]: 45,
  [XP_SOURCES.FOUNDING_TESTER_COMPLETED]: 60,
  [XP_SOURCES.EVENT_PARTICIPATION]: 15,
  [XP_SOURCES.BATTLE_PASS_MILESTONE]: 25,
  [XP_SOURCES.STREAK_MILESTONE]: 30,
  [XP_SOURCES.CALLING_CARD_UNLOCKED]: 20,
  [XP_SOURCES.EGG_COLLECTED]: 15,
  [XP_SOURCES.TASK_COMPLETION]: 12,
  [XP_SOURCES.DAILY_LOGIN]: 25,
  [XP_SOURCES.SUPPLY_DROP]: 20,
});

const SOURCE_LABELS = Object.freeze({
  [XP_SOURCES.ALERT_CREATED]: 'Alerts created',
  [XP_SOURCES.ALERT_CLICKED]: 'Alerts acted on',
  [XP_SOURCES.BEST_MOVE_USED]: 'Best Moves used',
  [XP_SOURCES.AUCTION_WON]: 'Auctions won',
  [XP_SOURCES.PURCHASE_COMPLETED]: 'Purchases completed',
  [XP_SOURCES.REFERRAL_COMPLETED]: 'Referrals completed',
  [XP_SOURCES.SCOUT_FLIGHT_RUN]: 'Scout Flight tournament run',
  [XP_SOURCES.SCOUT_FLIGHT_RANK]: 'Scout Flight rank bonus',
  [XP_SOURCES.CONTRACT_COMPLETED]: 'Contract completed',
  [XP_SOURCES.FOUNDING_TESTER_COMPLETED]: 'Founding Tester mission',
  [XP_SOURCES.EVENT_PARTICIPATION]: 'Event participation',
  [XP_SOURCES.BATTLE_PASS_MILESTONE]: 'Battle Pass milestone',
  [XP_SOURCES.STREAK_MILESTONE]: 'Login streak milestone',
  [XP_SOURCES.CALLING_CARD_UNLOCKED]: 'Calling card unlocked',
  [XP_SOURCES.EGG_COLLECTED]: 'Egg collected',
  [XP_SOURCES.ADMIN_GRANT]: 'Admin grant',
  [XP_SOURCES.TASK_COMPLETION]: 'Task completed',
  [XP_SOURCES.DAILY_LOGIN]: 'Daily login',
  [XP_SOURCES.SUPPLY_DROP]: 'Supply drop reward',
});

const RECAP_CONFIG = Object.freeze({
  minXpToShowRecap: 50,
  triggers: Object.freeze([
    'event_end',
    'mission_complete',
    'level_up',
    'milestone_unlock',
    'session_end',
  ]),
  eventXpMultiplier: 1,
});

/** Level milestone unlocks shown in recap popups. */
const LEVEL_MILESTONES = Object.freeze([
  {
    level: 10,
    title: 'LEVEL 10 REACHED',
    unlocks: [
      'Second active contract slot',
      'Bronze Profile Frame',
      '+250 Savvy',
      'New calling card',
    ],
  },
  {
    level: 25,
    title: 'LEVEL 25 REACHED',
    unlocks: [
      'Gold Contracts',
      'Faster alert perk eligibility',
      'Animated emblem',
      '+1 Supply Drop',
    ],
  },
]);

function labelForSource(source) {
  return SOURCE_LABELS[source] || String(source || 'Activity').replace(/_/g, ' ');
}

function defaultAmountForSource(source) {
  return Number(XP_AMOUNTS[source]) || 0;
}

module.exports = {
  XP_SOURCES,
  XP_AMOUNTS,
  SOURCE_LABELS,
  RECAP_CONFIG,
  LEVEL_MILESTONES,
  labelForSource,
  defaultAmountForSource,
};
