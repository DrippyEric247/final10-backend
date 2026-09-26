/**
 * SavvyTrip app contracts — progress authority remains Savvy Core.
 *
 * @module @savvy/core/config/contracts/savvytrip
 */

export const SAVVY_TRIP_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'savvytrip_core_proof_action',
    appId: 'savvytrip',
    appLabel: 'SavvyTrip',
    scope: 'app',
    objectiveType: 'PROOF_ACTION',
    title: 'SavvyTrip Core Proof Action',
    description: 'Internal App #2 integration proof — no payout',
    type: 'once',
    difficulty: 'easy',
    trigger: 'savvytrip_core_proof',
    target: 1,
    reward: { type: 'none', amount: 0, label: 'Proof only' },
    icon: '🧪',
  }),
]);

export const SAVVY_TRIP_CONTRACT_IDS = SAVVY_TRIP_CONTRACTS.map((c) => c.id);
