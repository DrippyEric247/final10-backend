const mongoose = require('mongoose');

const savvyFlipRewardLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: {
      type: String,
      enum: ['listing_bonus', 'sale_stack'],
      required: true,
    },
    idempotencyKey: { type: String, required: true, unique: true },
    points: { type: Number, required: true },
    sellerListingId: { type: String, default: '' },
    breakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    cappedPoints: { type: Number, default: 0 },
    flipScoreAtCompletion: { type: Number, default: null },
  },
  { timestamps: true }
);

savvyFlipRewardLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyFlipRewardLog', savvyFlipRewardLogSchema);
