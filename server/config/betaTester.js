/** Beta / Founding Tester program constants */
const BETA_FEEDBACK_SAVVY_BONUS = 100;

const BETA_UNLIMITED = Object.freeze({
  bestMovesPerDay: Number.POSITIVE_INFINITY,
  alertsMax: Number.POSITIVE_INFINITY,
  projectAlertsEnabled: true,
  projectActiveMax: Number.POSITIVE_INFINITY,
  projectItemsMaxPerProject: Number.POSITIVE_INFINITY,
});

module.exports = {
  BETA_FEEDBACK_SAVVY_BONUS,
  BETA_UNLIMITED,
};
