/**
 * Jest config for unit tests that must not require external services.
 *
 * Excludes integration suites that hard-require MONGODB_URI (they throw
 * when unset). Suites that use describe.skip when Mongo is missing are
 * also excluded here so `npm run test:unit` stays fast and deterministic
 * for Cloud Agents without a database.
 *
 * Usage: npm run test:unit
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/tests/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    // Uses Node's built-in test runner (node:test), not Jest
    '<rootDir>/__tests__/founderMessageService.test.js',
    // Hard-require Mongo (throw when MONGODB_URI unset)
    '<rootDir>/__tests__/referral-tracking.test.js',
    '<rootDir>/__tests__/trailerPromo.test.js',
    // Integration / e2e — skip or need live Mongo / external APIs
    '<rootDir>/__tests__/alert-flow.e2e.test.js',
    '<rootDir>/__tests__/authority-wave4.test.js',
    '<rootDir>/__tests__/authority-wave5.test.js',
    '<rootDir>/__tests__/battle-pass-trust.test.js',
    '<rootDir>/__tests__/contracts-integration.test.js',
    '<rootDir>/__tests__/dealStreak.test.js',
    '<rootDir>/__tests__/economy-integrity.test.js',
    '<rootDir>/__tests__/economy-p0.test.js',
    '<rootDir>/__tests__/economy-truth-wave1.test.js',
    '<rootDir>/__tests__/entitlement-wave2-closure.test.js',
    '<rootDir>/__tests__/featureVoteReward.test.js',
    '<rootDir>/__tests__/perkMachinePaidSpinRegression.test.js',
    '<rootDir>/__tests__/perkMachineRewardGrantWiring.test.js',
    '<rootDir>/__tests__/perkMachineSpin.test.js',
    '<rootDir>/__tests__/perkMachineWalletDebitWiring.test.js',
    '<rootDir>/__tests__/progression-wave3-deal-streak-integration.test.js',
    '<rootDir>/__tests__/progression-wave3-free-perk-hour.test.js',
    '<rootDir>/__tests__/referral-integrity.test.js',
    '<rootDir>/__tests__/savvyWatchLiveWelcomeBonus.test.js',
    '<rootDir>/__tests__/scoutFlightTournament.test.js',
    '<rootDir>/__tests__/wave6-closure.test.js',
    '<rootDir>/__tests__/wave7-closure.test.js',
  ],
  clearMocks: true,
};
