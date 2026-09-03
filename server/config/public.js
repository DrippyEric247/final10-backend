const C = require('./points');
const { isBetaMode } = require('./betaMode');
const { isSavvyWatchEnabled, isSavvyWatchAdminOnly } = require('./savvyWatchConfig');
const { isSavvyPredictionsEnabled, isSavvyPredictionsAdminOnly } = require('./savvyPredictionsConfig');

function getPublicConfig() {
  return {
    trialDays: C.TRIAL_DAYS,
    trialBonusMultiplier: C.TRIAL_BONUS_MULTIPLIER,
    premiumBonusMultiplier: C.PREMIUM_BONUS_MULTIPLIER,
    weekendMultiplier: C.WEEKEND_MULTIPLIER,
    badgeTiers: C.BADGE_TIERS,
    discountRatio: C.DISCOUNT_RATIO,
    betaMode: isBetaMode(),
    savvyWatchEnabled: isSavvyWatchEnabled(),
    savvyWatchAdminOnly: isSavvyWatchAdminOnly(),
    savvyPredictionsEnabled: isSavvyPredictionsEnabled(),
    savvyPredictionsAdminOnly: isSavvyPredictionsAdminOnly(),
    version: 'v1',
  };
}

module.exports = { getPublicConfig };
