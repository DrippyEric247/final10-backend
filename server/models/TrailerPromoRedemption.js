const mongoose = require('mongoose');

const trailerPromoRedemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    username: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    ipAddress: { type: String, default: null, trim: true },
    savvyAmount: { type: Number, default: 0 },
    savvyTransactionKey: { type: String, default: null },
    callingCardId: { type: String, default: null },
    callingCardGranted: { type: Boolean, default: false },
    supplyDropId: { type: String, default: null },
    rewardsGranted: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

trailerPromoRedemptionSchema.index({ userId: 1, code: 1 }, { unique: true });
trailerPromoRedemptionSchema.index({ code: 1, createdAt: -1 });
trailerPromoRedemptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TrailerPromoRedemption', trailerPromoRedemptionSchema);
