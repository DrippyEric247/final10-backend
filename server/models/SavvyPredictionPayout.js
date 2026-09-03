const mongoose = require('mongoose');

const savvyPredictionPayoutSchema = new mongoose.Schema(
  {
    payoutId: { type: String, required: true, unique: true, index: true },
    predictionId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entryId: { type: String, required: true, index: true },
    payoutType: { type: String, enum: ['correct', 'streak_bonus', 'perfect_combo'], default: 'correct' },
    savvyAmount: { type: Number, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    transactionId: { type: String, default: null },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    denialReason: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyPredictionPayoutSchema.index({ predictionId: 1, userId: 1, payoutType: 1 });
savvyPredictionPayoutSchema.index({ eventId: 1, userId: 1 });

module.exports = mongoose.model('SavvyPredictionPayout', savvyPredictionPayoutSchema);
