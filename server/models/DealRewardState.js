const mongoose = require('mongoose');

const dealRewardStateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    listingId: { type: String, required: true, index: true },
    status: { type: String, enum: ['pending', 'claimed'], default: 'pending' },
    baseSavvy: { type: Number, default: 0 },
    eventBonus: { type: Number, default: 0 },
    totalSavvy: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

dealRewardStateSchema.index({ userId: 1, listingId: 1 }, { unique: true });

module.exports = mongoose.model('DealRewardState', dealRewardStateSchema);
