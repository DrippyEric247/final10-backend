/** Monthly Scout Goals completion bonus by subscription tier (Savvy). */
const MONTHLY_GOALS_COMPLETION_BONUS = Object.freeze({
  free: 1000,
  core: 1250,
  premium: 1250,
  pro: 1500,
  elite: 1500,
});

/** Default per-goal Savvy reward when not specified on template. */
const DEFAULT_GOAL_REWARD_SAVVY = 100;

module.exports = {
  MONTHLY_GOALS_COMPLETION_BONUS,
  DEFAULT_GOAL_REWARD_SAVVY,
};
