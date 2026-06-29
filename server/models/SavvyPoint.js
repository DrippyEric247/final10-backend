const mongoose = require('mongoose');

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

// Static method to award points
savvyPointSchema.statics.awardPoints = async function(userId, points, type, note, relatedId = null, relatedType = null, multiplier = 1) {
  try {
    const amt = Math.round((Number(points) || 0) * (Number(multiplier) || 1));

    const savvyPoint = new this({
      user_id: userId,
      type: type,
      amount: amt,
      note: note
    });
    await savvyPoint.save();

    if (type === 'alert_trigger') {
      const { creditSavvy } = require('../services/savvyBalanceService');
      const ref = relatedId ? String(relatedId) : 'alert';
      await creditSavvy(userId, {
        amount: amt,
        source: 'alert_trigger',
        idempotencyKey: `alert_trigger:${userId}:${ref}:${amt}`,
        note,
        meta: { relatedId: ref, relatedType },
      });
      return savvyPoint;
    }

    const User = require('./User');
    await User.findByIdAndUpdate(userId, { $inc: { points: amt } });
    
    return savvyPoint;
  } catch (error) {
    throw error;
  }
};

// Static method to redeem points
savvyPointSchema.statics.redeemPoints = async function(userId, points, note) {
  try {
    const User = require('./User');
    
    // Check if user has enough points
    const user = await User.findById(userId);
    if (!user || user.points < points) {
      throw new Error('Insufficient points');
    }
    
    // Create redemption record
    const savvyPoint = new this({
      user_id: userId,
      type: 'redemption',
      amount: -points,
      note: note
    });
    await savvyPoint.save();
    
    // Update user's total points
    await User.findByIdAndUpdate(userId, {
      $inc: { points: -points }
    });
    
    return savvyPoint;
  } catch (error) {
    throw error;
  }
};

module.exports = mongoose.model('SavvyPoint', savvyPointSchema);