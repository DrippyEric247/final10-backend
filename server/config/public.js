const C = require('./points');

function getPublicConfig() {
  return {
    trialDays: C.TRIAL_DAYS,
    trialBonusMultiplier: C.TRIAL_BONUS_MULTIPLIER,
    premiumBonusMultiplier: C.PREMIUM_BONUS_MULTIPLIER,
    weekendMultiplier: C.WEEKEND_MULTIPLIER,
    badgeTiers: C.BADGE_TIERS,
    discountRatio: C.DISCOUNT_RATIO,
    version: 'v1'
  };
}

module.exports = { getPublicConfig };
