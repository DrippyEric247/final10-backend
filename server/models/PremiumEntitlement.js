const mongoose = require('mongoose');

const PREMIUM_STATUSES = [
  'inactive',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
];

const PREMIUM_TIERS = ['free', 'premium', 'vip', 'elite'];

const PROVIDERS = ['stripe', 'apple', 'google'];

const premiumEntitlementSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    premiumStatus: {
      type: String,
      enum: PREMIUM_STATUSES,
      default: 'inactive',
      index: true,
    },
    premiumTier: { type: String, enum: PREMIUM_TIERS, default: 'free' },
    provider: { type: String, enum: PROVIDERS, default: 'stripe' },
    providerCustomerId: { type: String, default: null, index: true },
    providerSubscriptionId: { type: String, default: null, index: true },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    trialEndsAt: { type: Date, default: null },
    lastVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

premiumEntitlementSchema.index({ providerSubscriptionId: 1 }, { sparse: true });

module.exports = mongoose.model('PremiumEntitlement', premiumEntitlementSchema);
module.exports.PREMIUM_STATUSES = PREMIUM_STATUSES;
