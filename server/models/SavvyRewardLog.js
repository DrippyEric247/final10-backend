const mongoose = require('mongoose');

const savvyRewardLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rewardType: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    baseAmount: { type: Number, default: 0 },
    multiplier: { type: Number, default: 1 },
    streakBonus: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    tier: { type: String, default: 'free' },
    idempotencyKey: { type: String, required: true, unique: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyRewardLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyRewardLog', savvyRewardLogSchema);
