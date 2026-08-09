/**
 * Final10 app-specific contracts — objectives tied to deal hunting, auctions,
 * streaks, Scout Flight, and Perk Machine inside Final10.
 *
 * @module @savvy/core/config/contracts/final10
 */

/** @typedef {'daily'|'weekly'|'seasonal'|'event'|'challenge'|'hidden'|'universal'|'app'} ContractType */

/**
 * @typedef {object} ContractReward
 * @property {'savvy'|'savvy_coins'|'perk_spin'|'egg'|'scout_flight_ticket'|'contract_xp'|'cosmetic'|'multiplier'} type
 * @property {number} [amount]
 * @property {string} [cosmeticId]
 * @property {string} [label]
 */

/**
 * @typedef {object} ContractDefinition
 * @property {string} id
 * @property {string} appId
 * @property {'app'|'universe'} scope
 * @property {string} title
 * @property {string} description
 * @property {ContractType} type
 * @property {string} [difficulty]
 * @property {string} trigger
 * @property {number} target
 * @property {ContractReward} reward
 * @property {string} icon
 * @property {boolean} [isHidden]
 * @property {string} [appLabel]
 */

/** @type {readonly ContractDefinition[]} */
export const FINAL10_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'final10_deal_hunter',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Deal Hunter',
    description: 'Find qualifying deals',
    type: 'daily',
    difficulty: 'normal',
    trigger: 'deal_found',
    target: 5,
    reward: { type: 'savvy', amount: 100, label: '+100 Savvy' },
    icon: '🎯',
  }),
  Object.freeze({
    id: 'final10_auction_closer',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Auction Closer',
    description: 'Win a tracked auction',
    type: 'daily',
    difficulty: 'hard',
    trigger: 'auction_won',
    target: 1,
    reward: { type: 'savvy', amount: 250, label: '+250 Savvy' },
    icon: '🏆',
  }),
  Object.freeze({
    id: 'final10_savvy_streak',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Savvy Streak',
    description: 'Complete a 5-deal Deal Streak',
    type: 'weekly',
    difficulty: 'hard',
    trigger: 'deal_streak_complete',
    target: 1,
    reward: { type: 'savvy', amount: 300, label: '+300 Savvy' },
    icon: '🔥',
  }),
  Object.freeze({
    id: 'final10_deep_discount',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Deep Discount',
    description: 'Find a deal at least 40% below estimated market value',
    type: 'daily',
    difficulty: 'normal',
    trigger: 'deep_discount_deal',
    target: 1,
    reward: { type: 'savvy', amount: 150, label: '+150 Savvy' },
    icon: '💎',
  }),
  Object.freeze({
    id: 'final10_scout_pilot',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Scout Pilot',
    description: 'Submit a Savvy Scout Flight run',
    type: 'daily',
    difficulty: 'normal',
    trigger: 'scout_flight_run',
    target: 1,
    reward: { type: 'savvy', amount: 75, label: '+75 Savvy' },
    icon: '✈️',
  }),
  Object.freeze({
    id: 'final10_perk_user',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Perk User',
    description: 'Spin the Perk Machine',
    type: 'daily',
    difficulty: 'easy',
    trigger: 'perk_machine_spin',
    target: 3,
    reward: { type: 'perk_spin', spinToken: 'paid3Spin', amount: 1, label: '+1 Perk Spin' },
    icon: '🎰',
  }),
  Object.freeze({
    id: 'final10_weekend_rush',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Weekend Rush',
    description: 'Win an auction during the live event window',
    type: 'event',
    eventKey: 'final10-weekend-rush',
    expiresInHours: 72,
    difficulty: 'hard',
    trigger: 'auction_won',
    target: 1,
    reward: { type: 'scout_flight_ticket', amount: 1, label: '+1 Tournament Ticket' },
    icon: '🎟️',
  }),
  Object.freeze({
    id: 'final10_hidden_signal',
    appId: 'final10',
    appLabel: 'FINAL10',
    scope: 'app',
    title: 'Signal Found',
    description: 'Discover a deep discount deal',
    type: 'hidden',
    difficulty: 'hard',
    trigger: 'deep_discount_deal',
    target: 1,
    isHidden: true,
    revealBeforeDiscovery: false,
    hiddenHint: 'Hidden objective — find an exceptional discount to reveal this contract.',
    reward: { type: 'egg', eggTier: 'rare', amount: 1, label: '+1 Rare Egg' },
    icon: '🥚',
  }),
]);

export const FINAL10_CONTRACT_IDS = Object.freeze(FINAL10_CONTRACTS.map((c) => c.id));
