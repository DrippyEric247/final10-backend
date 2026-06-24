const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const {
  SUBSCRIPTION_TIERS,
  YEARLY_BONUS,
  EARLY_ADOPTER_LIMIT,
  normalizeTier,
  normalizeBilling,
  getTierConfig,
  computeSavings,
  getPaidSubscriptionPlans,
} = require('../config/subscriptionPlans');

const router = express.Router();

function nextRenewalDate(billing) {
  const d = new Date();
  if (billing === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function legacyMembershipForTier(tier) {
  if (tier === 'free') return 'free';
  if (tier === 'core') return 'premium';
  return 'pro';
}

router.get('/plans', auth, async (_req, res) => {
  const plans = getPaidSubscriptionPlans().map((p) => ({
    ...p,
    savings: computeSavings(p),
    bestMovesLabel: Number.isFinite(p.bestMovesPerDay) ? `${p.bestMovesPerDay}/day` : 'Unlimited',
  }));
  res.json({ plans, yearlyBonus: YEARLY_BONUS });
});

router.post('/metrics', auth, async (req, res) => {
  const { event, tier, billing, meta } = req.body || {};
  if (!event) return res.status(400).json({ message: 'event is required' });
  await User.findByIdAndUpdate(req.user.id, {
    $push: {
      subscriptionMetrics: {
        event: String(event),
        tier: String(tier || ''),
        billing: String(billing || ''),
        meta: meta && typeof meta === 'object' ? meta : {},
      },
    },
  });
  res.json({ ok: true });
});

router.post('/', auth, async (req, res) => {
  const requestedTier = normalizeTier(req.body?.tier);
  const billing = normalizeBilling(req.body?.billing);
  if (requestedTier === 'free') {
    return res.status(400).json({ message: 'Paid tier required' });
  }
  const tierConfig = getTierConfig(requestedTier);
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const price = billing === 'yearly' ? tierConfig.yearlyPrice : tierConfig.monthlyPrice;
  let multiplier = tierConfig.multiplier;
  const bonusGranted = billing === 'yearly';
  if (bonusGranted) {
    multiplier += YEARLY_BONUS.multiplierBoost;
    user.savvyPoints = Number(user.savvyPoints || 0) + YEARLY_BONUS.savvyPointsBonus;
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.badges.includes(YEARLY_BONUS.badge)) user.badges.push(YEARLY_BONUS.badge);
  }

  let earlyAdopterLocked = Boolean(user.earlyAdopterLocked);
  if (!earlyAdopterLocked) {
    const currentLocks = await User.countDocuments({ earlyAdopterLocked: true });
    if (currentLocks < EARLY_ADOPTER_LIMIT) {
      earlyAdopterLocked = true;
      user.earlyAdopterLocked = true;
      user.earlyAdopterOriginalPrice = {
        monthlyPrice: tierConfig.monthlyPrice,
        yearlyPrice: tierConfig.yearlyPrice,
        tier: requestedTier.toUpperCase(),
      };
    }
  }

  const renewalDate = nextRenewalDate(billing);
  user.subscription = {
    tier: requestedTier,
    billing,
    multiplier,
    monthlyPriceLocked: tierConfig.monthlyPrice,
    yearlyPriceLocked: tierConfig.yearlyPrice,
    renewalDate,
    earlyAdopter: bonusGranted ? YEARLY_BONUS.earlyAdopter : Boolean(user.subscription?.earlyAdopter),
    badge: bonusGranted ? YEARLY_BONUS.badge : String(user.subscription?.badge || ''),
  };
  user.membershipTier = legacyMembershipForTier(requestedTier);
  user.premiumTier = user.membershipTier;
  user.isPremium = requestedTier !== 'free';
  user.subscriptionExpires = renewalDate;
  await user.save();

  await User.findByIdAndUpdate(user._id, {
    $push: {
      subscriptionMetrics: {
        event: 'conversion_rate',
        tier: requestedTier,
        billing,
        meta: {
          price,
          bonusGranted,
          earlyAdopterLocked,
        },
      },
    },
  });

  return res.json({
    ok: true,
    priceCharged: price,
    bonusGranted,
    yearlyBonus: bonusGranted ? YEARLY_BONUS : null,
    subscription: {
      tier: requestedTier.toUpperCase(),
      billing,
      multiplier,
      earlyAdopter: Boolean(user.subscription.earlyAdopter),
      renewalDate,
      alertsMax: tierConfig.alertsMax,
      alertsSpeed: tierConfig.alertsSpeed,
      bestMovesPerDay: tierConfig.bestMovesPerDay,
    },
    savvyPoints: user.savvyPoints,
    badges: user.badges || [],
    earlyAdopterLocked: Boolean(user.earlyAdopterLocked),
    earlyAdopterOriginalPrice: user.earlyAdopterOriginalPrice || null,
  });
});

module.exports = router;
