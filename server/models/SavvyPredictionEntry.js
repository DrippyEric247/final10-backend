const mongoose = require('mongoose');
const { ENTRY_OUTCOMES } = require('../config/savvyPredictionsConfig');

const savvyPredictionEntrySchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, unique: true, index: true },
    predictionId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    selectedOptionId: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
    lockedAt: { type: Date, default: null },
    outcome: { type: String, enum: ENTRY_OUTCOMES, default: 'pending', index: true },
    rewardAmount: { type: Number, default: 0 },
    rewardedAt: { type: Date, default: null },
    streakAtResolve: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyPredictionEntrySchema.index({ predictionId: 1, userId: 1 }, { unique: true });
savvyPredictionEntrySchema.index({ eventId: 1, userId: 1, createdAt: -1 });
savvyPredictionEntrySchema.index({ userId: 1, outcome: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyPredictionEntry', savvyPredictionEntrySchema);
