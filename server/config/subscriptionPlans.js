const SUBSCRIPTION_TIERS = Object.freeze({
  free: {
    id: 'free',
    label: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    multiplier: 1.0,
    dailyLoginBonus: 0.5,
    bestMovesPerDay: 3,
    alertsMax: 3,
    alertsSpeed: 'delayed',
    projectAlertsEnabled: false,
    projectActiveMax: 0,
    projectItemsMaxPerProject: 0,
    projectBundleSavings: false,
    projectPriceTargetsPerItem: false,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
  },
  core: {
    id: 'core',
    label: 'CORE',
    monthlyPrice: 15,
    yearlyPrice: 129,
    multiplier: 1.25,
    dailyLoginBonus: 0.75,
    bestMovesPerDay: 5,
    alertsMax: 10,
    alertsSpeed: 'semi_fast',
    projectAlertsEnabled: true,
    projectActiveMax: 1,
    projectItemsMaxPerProject: 5,
    projectBundleSavings: false,
    projectPriceTargetsPerItem: false,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
  },
  pro: {
    id: 'pro',
    label: 'PRO',
    monthlyPrice: 25,
    yearlyPrice: 219,
    multiplier: 1.5,
    dailyLoginBonus: 1.0,
    bestMovesPerDay: 15,
    alertsMax: 25,
    alertsSpeed: 'real_time',
    projectAlertsEnabled: true,
    projectActiveMax: 3,
    projectItemsMaxPerProject: 15,
    projectBundleSavings: true,
    projectPriceTargetsPerItem: true,
    projectAiPartsList: false,
    projectVoiceCreation: false,
    projectAllPartsReadyNotify: false,
    projectPriorityAlerts: false,
  },
  elite: {
    id: 'elite',
    label: 'ELITE',
    monthlyPrice: 35,
    yearlyPrice: 299,
    multiplier: 2.0,
    dailyLoginBonus: 1.25,
    bestMovesPerDay: Number.POSITIVE_INFINITY,
    alertsMax: Number.POSITIVE_INFINITY,
    alertsSpeed: 'priority',
    projectAlertsEnabled: true,
    projectActiveMax: null,
    projectItemsMaxPerProject: null,
    projectBundleSavings: true,
    projectPriceTargetsPerItem: true,
    projectAiPartsList: true,
    projectVoiceCreation: true,
    projectAllPartsReadyNotify: true,
    projectPriorityAlerts: true,
  },
});

const YEARLY_BONUS = Object.freeze({
  savvyPointsBonus: 1000,
  multiplierBoost: 0.25,
  earlyAdopter: true,
  badge: 'Early Adopter',
});

const EARLY_ADOPTER_LIMIT = 10000;

function normalizeTier(rawTier) {
  const tier = String(rawTier || '').toLowerCase();
  if (!tier || tier === 'free') return 'free';
  if (tier === 'core' || tier.includes('plus') || tier.includes('premium')) return 'core';
  if (tier === 'pro' || tier.includes('14') || tier === 'savvy_pro') return 'pro';
  if (tier === 'elite' || tier.includes('35')) return 'elite';
  return 'core';
}

function normalizeBilling(rawBilling) {
  const b = String(rawBilling || '').toLowerCase();
  return b === 'yearly' ? 'yearly' : 'monthly';
}

function getTierConfig(rawTier) {
  const tier = normalizeTier(rawTier);
  return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
}

function computeSavings(tierConfig) {
  if (!tierConfig || !tierConfig.monthlyPrice || !tierConfig.yearlyPrice) return 0;
  return Math.max(0, tierConfig.monthlyPrice * 12 - tierConfig.yearlyPrice);
}

module.exports = {
  SUBSCRIPTION_TIERS,
  YEARLY_BONUS,
  EARLY_ADOPTER_LIMIT,
  normalizeTier,
  normalizeBilling,
  getTierConfig,
  computeSavings,
};
