/**
 * SavvyTrip test contracts — integration test only.
 */
export const SAVVY_TRIP_TEST_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'savvytrip_test_complete_booking',
    appId: 'savvytrip_test',
    appLabel: 'SavvyTrip Test',
    scope: 'app',
    title: 'Complete a Booking',
    description: 'Test contract for Savvy Core V1 integration',
    type: 'once',
    difficulty: 'easy',
    trigger: 'trip_booked',
    target: 1,
    reward: { type: 'savvy', amount: 25, label: '+25 Savvy' },
    icon: '✈️',
  }),
  Object.freeze({
    id: 'savvytrip_test_proof_action',
    appId: 'savvytrip_test',
    appLabel: 'SavvyTrip Test',
    scope: 'app',
    objectiveType: 'PROOF_ACTION',
    title: 'Production Proof Action',
    description: 'Internal Savvy Core V1 production proof — no payout',
    type: 'once',
    difficulty: 'easy',
    trigger: 'proof_action',
    target: 1,
    reward: { type: 'none', amount: 0, label: 'Proof only' },
    icon: '🧪',
  }),
]);

export const SAVVY_TRIP_TEST_CONTRACT_IDS = SAVVY_TRIP_TEST_CONTRACTS.map((c) => c.id);
