/**
 * Wave 6 — centralized data authority / compatibility read layer.
 * Do not scatter ad-hoc `user.a || user.b || user.c` patterns across the codebase.
 */

const savvyBalance = require('./savvyBalance');
const loginStreak = require('./loginStreak');
const migration = require('./migration');
const entitlements = require('./entitlements');
const dailyTaskSavvy = require('./dailyTaskSavvy');

module.exports = {
  ...savvyBalance,
  ...loginStreak,
  ...migration,
  ...entitlements,
  ...dailyTaskSavvy,
};
