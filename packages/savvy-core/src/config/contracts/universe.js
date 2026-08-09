/**
 * Savvy Universe cross-app contracts — occasional objectives spanning apps.
 *
 * @module @savvy/core/config/contracts/universe
 */

/** @type {readonly import('./final10.js').ContractDefinition[]} */
export const UNIVERSE_CONTRACTS = Object.freeze([
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

export const UNIVERSE_CONTRACT_IDS = Object.freeze(UNIVERSE_CONTRACTS.map((c) => c.id));
