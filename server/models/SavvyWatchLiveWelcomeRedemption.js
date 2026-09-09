const mongoose = require('mongoose');

const savvyWatchLiveWelcomeRedemptionSchema = new mongoose.Schema(
  {
    redemptionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    eventSlug: { type: String, required: true, index: true },
    source: { type: String, required: true, default: 'stream-qr', index: true },
    amount: { type: Number, required: true, default: 500 },
    idempotencyKey: { type: String, required: true, unique: true },
    transactionId: { type: String, default: null },
    redeemedAt: { type: Date, required: true, default: Date.now, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyWatchLiveWelcomeRedemptionSchema.index({ eventId: 1, redeemedAt: -1 });
savvyWatchLiveWelcomeRedemptionSchema.index({ eventSlug: 1, redeemedAt: -1 });

module.exports = mongoose.model('SavvyWatchLiveWelcomeRedemption', savvyWatchLiveWelcomeRedemptionSchema);
