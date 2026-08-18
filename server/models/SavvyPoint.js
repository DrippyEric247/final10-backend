const mongoose = require('mongoose');
const crypto = require('crypto');

const savvyPointSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'daily_login',
      'redemption',
      'bonus',
      'purchase',
      'bid',
      'share',
      'referral',
      'signup_referral',
      'review',
      'welcome',
      'auction_creation',
      'social_post',
      'app_share',
      'product_share',
      'search_task',
      'ad_watch',
      'alert_trigger'
    ],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  note: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
// Note: createdAt index is automatically created by timestamps: true
savvyPointSchema.index({ user_id: 1, createdAt: -1 });
savvyPointSchema.index({ type: 1 });

// Static method to award points — canonical Savvy wallet (Wave 6)
savvyPointSchema.statics.awardPoints = async function(userId, points, type, note, relatedId = null, relatedType = null, multiplier = 1) {
  const amt = Math.round((Number(points) || 0) * (Number(multiplier) || 1));
  if (amt <= 0) {
    return null;
  }

  const User = require('./User');
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const ref = relatedId ? String(relatedId) : type;
  const { grantSavvyReward } = require('../services/savvyRewardService');
  await grantSavvyReward(user, {
    rewardType: type || 'legacy_award',
    amount: amt,
    baseAmount: Math.round(Number(points) || 0),
    idempotencyKey: `savvy_point_award:${userId}:${type}:${ref}:${amt}`,
    note,
    meta: { relatedId: ref, relatedType, legacySavvyPoint: true },
  });

  if (process.env.SAVVY_LEGACY_POINT_LEDGER === '1') {
    const savvyPoint = new this({
      user_id: userId,
      type,
      amount: amt,
      note,
    });
    await savvyPoint.save();
    return savvyPoint;
  }

  return { user_id: userId, type, amount: amt, note, legacy: true };
};

// Static method to redeem points — canonical debitSavvy (Wave 6)
savvyPointSchema.statics.redeemPoints = async function(userId, points, note) {
  const spend = Math.round(Number(points) || 0);
  if (spend <= 0) {
    throw new Error('Invalid redemption amount');
  }

  const User = require('./User');
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const { debitSavvy, InsufficientSavvyError } = require('../services/savvyBalanceService');
  const idempotencyKey = `savvy_point_redeem:${userId}:${crypto.createHash('sha256').update(String(note || '')).digest('hex').slice(0, 16)}:${spend}`;

  try {
    await debitSavvy(user, {
      amount: spend,
      source: 'legacy_redeem',
      idempotencyKey,
      note,
      meta: { legacySavvyPoint: true },
    });
  } catch (err) {
    if (err instanceof InsufficientSavvyError) {
      throw new Error('Insufficient points');
    }
    throw err;
  }

  if (process.env.SAVVY_LEGACY_POINT_LEDGER === '1') {
    const savvyPoint = new this({
      user_id: userId,
      type: 'redemption',
      amount: -spend,
      note,
    });
    await savvyPoint.save();
    return savvyPoint;
  }

  return { user_id: userId, type: 'redemption', amount: -spend, note, legacy: true };
};

module.exports = mongoose.model('SavvyPoint', savvyPointSchema);