/**
 * Admin/dev-only forced rewards for Perk Machine regression testing.
 * Never exposed to ordinary users — resolved only via admin forceRewardId.
 */
const { SPIN_MODES } = require('./perkMachineRewards');

/** Minimal control reward for CASE A/B isolation. */
const TEST_SAVVY_1 = Object.freeze({
  id: 'TEST_SAVVY_1',
  type: 'savvy',
  amount: 1,
  label: '+1 Savvy (regression test)',
  icon: '🧪',
  rarity: 'common',
  weight: 0,
  adminOnly: true,
});

/** One representative reward per family for Phase 4 isolation. */
const REGRESSION_REWARD_FAMILIES = Object.freeze([
  { family: 'savvy', forceRewardId: 'TEST_SAVVY_1', label: 'Savvy +1 control' },
  { family: 'savvy_pool', forceRewardId: 'savvy_25', label: 'Savvy +25 pool' },
  { family: 'tournament_ticket', forceRewardId: 'scout_flight_ticket', label: 'Scout Flight Ticket' },
  { family: 'streak_shield', forceRewardId: 'streak_shield', label: 'Streak Shield' },
  { family: 'multiplier', forceRewardId: 'multiplier_2x', label: '2× Multiplier tile' },
  { family: 'free_spin', forceRewardId: 'egg_extra_spin', label: 'Extra Free Spin Egg' },
  { family: 'supply_drop', forceRewardId: 'supply_drop', label: 'Supply Drop' },
  { family: 'egg_common', forceRewardId: 'egg_common', label: 'Common Egg' },
  { family: 'egg_legendary', forceRewardId: 'egg_legendary', label: 'Legendary Egg' },
  { family: 'calling_card', forceRewardId: 'calling_card', label: 'Calling Card' },
  { family: 'battle_pass_token', forceRewardId: 'token_bp_xp', label: 'Battle Pass XP Token' },
  { family: 'savvy_level_token', forceRewardId: 'token_savvy_mult', label: 'Savvy Level XP Token' },
]);

const ADMIN_TEST_REWARD_BY_ID = Object.freeze({
  [TEST_SAVVY_1.id]: TEST_SAVVY_1,
});

function isAdminTestRewardId(rewardId) {
  return Boolean(ADMIN_TEST_REWARD_BY_ID[String(rewardId || '').trim()]);
}

function resolveAdminTestReward(rewardId) {
  const id = String(rewardId || '').trim();
  const def = ADMIN_TEST_REWARD_BY_ID[id];
  return def ? { ...def } : null;
}

function listRegressionRewardFamilies() {
  return REGRESSION_REWARD_FAMILIES.map((row) => ({ ...row }));
}

module.exports = {
  TEST_SAVVY_1,
  REGRESSION_REWARD_FAMILIES,
  ADMIN_TEST_REWARD_BY_ID,
  isAdminTestRewardId,
  resolveAdminTestReward,
  listRegressionRewardFamilies,
  DEFAULT_REGRESSION_MODE: SPIN_MODES.PAID_1,
};
