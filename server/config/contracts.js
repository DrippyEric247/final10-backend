/**
 * Server mirror of @savvy/core contract registry.
 * Keep in sync with packages/savvy-core/src/config/contracts/*
 */

const FINAL10_CONTRACTS = Object.freeze([
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

const UNIVERSE_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'universe_multi_app_contracts',
    appId: 'universe',
    appLabel: 'SAVVY UNIVERSE',
    scope: 'universe',
    title: 'Cross-App Operator',
    description: 'Claim 3 contracts from at least 2 different Savvy apps',
    type: 'universal',
    difficulty: 'hard',
    trigger: 'contract_claimed_cross_app',
    target: 3,
    minDistinctApps: 2,
    reward: { type: 'savvy', amount: 200, label: '+200 Savvy' },
    icon: '🌐',
  }),
  Object.freeze({
    id: 'universe_weekly_grind',
    appId: 'universe',
    appLabel: 'SAVVY UNIVERSE',
    scope: 'universe',
    title: 'Universe Grind',
    description: 'Complete 5 Savvy Universe contracts this week',
    type: 'weekly',
    difficulty: 'hard',
    trigger: 'contract_claimed',
    target: 5,
    reward: { type: 'savvy', amount: 350, label: '+350 Savvy' },
    icon: '⭐',
  }),
]);

const ALL_CONTRACTS = Object.freeze([...FINAL10_CONTRACTS, ...UNIVERSE_CONTRACTS]);

const BY_ID = Object.freeze(
  ALL_CONTRACTS.reduce((acc, def) => {
    acc[def.id] = def;
    return acc;
  }, {})
);

const BY_APP = Object.freeze(
  ALL_CONTRACTS.reduce((acc, def) => {
    const key = def.appId || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(def);
    return acc;
  }, {})
);

const BY_TRIGGER = Object.freeze(
  ALL_CONTRACTS.reduce((acc, def) => {
    if (!acc[def.trigger]) acc[def.trigger] = [];
    acc[def.trigger].push(def);
    return acc;
  }, {})
);

const PROGRESSION_EVENT_TO_CONTRACT_TRIGGER = Object.freeze({
  auction_won: 'auction_won',
});

const DEFAULT_CONTRACTS_APP_ID = 'final10';

function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const d = date;
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function periodKeyForContract(contract, date = new Date()) {
  const type = contract.type;
  if (type === 'daily' || type === 'challenge') return utcDayKey(date);
  if (type === 'weekly' || type === 'universal') return weekKey(date);
  if (type === 'seasonal') return `season-${date.getFullYear()}`;
  if (type === 'event') return contract.eventKey || `event-${utcDayKey(date)}`;
  return 'once';
}

function getContractById(contractId) {
  const id = String(contractId || '').trim();
  return BY_ID[id] || null;
}

function getContractsForApp(appId) {
  const key = String(appId || DEFAULT_CONTRACTS_APP_ID).trim();
  return BY_APP[key] || [];
}

function getUniverseContracts() {
  return UNIVERSE_CONTRACTS.slice();
}

function getContractsForTrigger(trigger) {
  const t = String(trigger || '').trim();
  return BY_TRIGGER[t] || [];
}

module.exports = {
  FINAL10_CONTRACTS,
  UNIVERSE_CONTRACTS,
  ALL_CONTRACTS,
  DEFAULT_CONTRACTS_APP_ID,
  PROGRESSION_EVENT_TO_CONTRACT_TRIGGER,
  utcDayKey,
  weekKey,
  periodKeyForContract,
  getContractById,
  getContractsForApp,
  getUniverseContracts,
  getContractsForTrigger,
};
