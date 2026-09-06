/**
 * GameSavvy test contracts — integration test only.
 */
export const GAME_SAVVY_TEST_CONTRACTS = Object.freeze([
  Object.freeze({
    id: 'gamesavvy_test_complete_match',
    appId: 'gamesavvy_test',
    appLabel: 'GameSavvy Test',
    scope: 'app',
    title: 'Complete a Match',
    description: 'Test contract for Savvy Core V1 integration',
    type: 'once',
    difficulty: 'easy',
    trigger: 'match_completed',
    target: 1,
    reward: { type: 'savvy', amount: 30, label: '+30 Savvy' },
    icon: '🎮',
  }),
]);

export const GAME_SAVVY_TEST_CONTRACT_IDS = GAME_SAVVY_TEST_CONTRACTS.map((c) => c.id);
