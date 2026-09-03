const mongoose = require('mongoose');

const savvyPredictionStreakSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventId: { type: String, required: true, index: true },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    totalPredictions: { type: Number, default: 0 },
    correctPredictions: { type: Number, default: 0 },
    lastOutcome: { type: String, enum: ['pending', 'correct', 'incorrect', 'void', null], default: null },
    lastResolvedAt: { type: Date, default: null },
    streakBonusesAwarded: { type: [Number], default: [] },
  },
  { timestamps: true }
);

savvyPredictionStreakSchema.index({ userId: 1, eventId: 1 }, { unique: true });
savvyPredictionStreakSchema.index({ eventId: 1, currentStreak: -1 });

module.exports = mongoose.model('SavvyPredictionStreak', savvyPredictionStreakSchema);
