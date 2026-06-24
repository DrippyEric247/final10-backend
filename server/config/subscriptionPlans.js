const SUBSCRIPTION_TIERS = Object.freeze({
  free: {
    id: 'free',
    label: 'FREE',
    marketingName: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    multiplier: 1.0,
    dailyLoginBonus: 0.5,
    bestMovesPerDay: 5,
    alertsMax: 5,
    alertsSpeed: 'basic',
    eventPointsBonusPct: 0,
    projectAlertsEnabled: false,
    projectActiveMax: 0,
    projectItemsMaxPerProject: 0,
    projectBundleSavings: false,
    projectPriceTargetsPerItem: false,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
    features: [
      '5 Best Moves per day',
      'Daily Login Streaks',
      'Free Battle Pass Track',
      'Basic Deal Alerts',
      'Savvy Points',
      'Calling Cards & Emblems',
      'Egg Collection',
      'Watchlist',
      'Referral Rewards',
      'Standard event multipliers',
    ],
  },
  core: {
    id: 'core',
    label: 'PREMIUM',
    marketingName: 'Premium',
    monthlyPrice: 7,
    yearlyPrice: 70,
    multiplier: 1.15,
    dailyLoginBonus: 0.75,
    bestMovesPerDay: 10,
    alertsMax: 15,
    alertsSpeed: 'faster',
    eventPointsBonusPct: 0.1,
    projectAlertsEnabled: true,
    projectActiveMax: 2,
    projectItemsMaxPerProject: 8,
    projectBundleSavings: false,
    projectPriceTargetsPerItem: false,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
    features: [
      '10 Best Moves per day',
      'Faster Alert Notifications',
      'Premium Battle Pass Track',
      'Premium Egg Drops',
      'Extra Watchlist Capacity',
      'Priority Deal Discovery',
      'Premium Calling Cards & Emblems',
      '+10% bonus during Double Points and Triple Points events',
    ],
  },
  pro: {
    id: 'pro',
    label: 'PRO',
    marketingName: 'Pro',
    monthlyPrice: 14,
    yearlyPrice: 140,
    multiplier: 1.35,
    dailyLoginBonus: 1.0,
    bestMovesPerDay: Number.POSITIVE_INFINITY,
    alertsMax: Number.POSITIVE_INFINITY,
    alertsSpeed: 'fastest',
    eventPointsBonusPct: 0.25,
    projectAlertsEnabled: true,
    projectActiveMax: 5,
    projectItemsMaxPerProject: 20,
    projectBundleSavings: true,
    projectPriceTargetsPerItem: true,
    projectAiPartsList: true,
    projectVoiceCreation: true,
    projectAllPartsReadyNotify: true,
    projectPriorityAlerts: true,
    features: [
      'Unlimited Best Moves',
      'Fastest Alert Notifications',
      'Highest Alert Priority',
      'Voice Features',
      'Early Access Features',
      'Pro Profile Badge',
      'Exclusive Mythic Reward Opportunities',
      'Increased Egg Drop Chances',
      '+25% bonus during Double Points and Triple Points events',
    ],
  },
  elite: {
    id: 'elite',
    label: 'PRO',
    marketingName: 'Pro',
    monthlyPrice: 14,
    yearlyPrice: 140,
    multiplier: 1.35,
    dailyLoginBonus: 1.0,
    bestMovesPerDay: Number.POSITIVE_INFINITY,
    alertsMax: Number.POSITIVE_INFINITY,
    alertsSpeed: 'fastest',
    eventPointsBonusPct: 0.25,
    projectAlertsEnabled: true,
    projectActiveMax: null,
    projectItemsMaxPerProject: null,
    projectBundleSavings: true,
    projectPriceTargetsPerItem: true,
    projectAiPartsList: true,
    projectVoiceCreation: true,
    projectAllPartsReadyNotify: true,
    projectPriorityAlerts: true,
    features: [
      'Unlimited Best Moves',
      'Fastest Alert Notifications',
      'Highest Alert Priority',
      'Voice Features',
      'Early Access Features',
      'Pro Profile Badge',
      'Exclusive Mythic Reward Opportunities',
      'Increased Egg Drop Chances',
      '+25% bonus during Double Points and Triple Points events',
    ],
  },
});

const YEARLY_BONUS = Object.freeze({
  savvyPointsBonus: 500,
  multiplierBoost: 0.1,
  earlyAdopter: true,
  badge: 'Early Adopter',
});

const EARLY_ADOPTER_LIMIT = 10000;

function normalizeTier(rawTier) {
  const tier = String(rawTier || '').toLowerCase();
  if (!tier || tier === 'free') return 'free';
  if (tier === 'elite' || tier.includes('35')) return 'pro';
  if (tier === 'pro' || tier.includes('14') || tier === 'savvy_pro') return 'pro';
  if (tier === 'core' || tier === 'premium' || tier.includes('plus') || tier.includes('7') || tier === 'savvy_plus') {
    return 'core';
  }
  return 'core';
}

function normalizeBilling(rawBilling) {
  const b = String(rawBilling || '').toLowerCase();
  return b === 'yearly' ? 'yearly' : 'monthly';
}

function getTierConfig(rawTier) {
  const tier = normalizeTier(rawTier);
  if (tier === 'pro') return SUBSCRIPTION_TIERS.pro;
  if (tier === 'core') return SUBSCRIPTION_TIERS.core;
  return SUBSCRIPTION_TIERS.free;
}

function computeSavings(tierConfig) {
  if (!tierConfig || !tierConfig.monthlyPrice || !tierConfig.yearlyPrice) return 0;
  return Math.max(0, tierConfig.monthlyPrice * 12 - tierConfig.yearlyPrice);
}

/** Paid plans exposed in upgrade UI (Free + legacy elite excluded). */
function getPaidSubscriptionPlans() {
  return Object.values(SUBSCRIPTION_TIERS).filter((p) => p.id === 'core' || p.id === 'pro');
}

module.exports = {
  SUBSCRIPTION_TIERS,
  YEARLY_BONUS,
  EARLY_ADOPTER_LIMIT,
  normalizeTier,
  normalizeBilling,
  getTierConfig,
  computeSavings,
  getPaidSubscriptionPlans,
};
