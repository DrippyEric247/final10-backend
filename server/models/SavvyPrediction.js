const mongoose = require('mongoose');
const { PREDICTION_TYPES, PREDICTION_STATUSES } = require('../config/savvyPredictionsConfig');

const optionSchema = new mongoose.Schema(
  {
    optionId: { type: String, required: true },
    label: { type: String, required: true },
    sortOrder: { type: Number, default: 0 },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    side: { type: String, default: null },
    participantRef: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const savvyPredictionSchema = new mongoose.Schema(
  {
    predictionId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: PREDICTION_TYPES, required: true, index: true },
    status: { type: String, enum: PREDICTION_STATUSES, default: 'draft', index: true },
    opensAt: { type: Date, default: null },
    locksAt: { type: Date, required: true, index: true },
    resolvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    options: { type: [optionSchema], default: [] },
    rewardConfig: {
      correctSavvy: { type: Number, default: 10 },
      streakBonusSavvy: { type: Number, default: 0 },
      perfectComboSavvy: { type: Number, default: 0 },
    },
    displayConfig: {
      hideDistributionUntilLock: { type: Boolean, default: true },
      showMatchup: { type: Boolean, default: true },
    },
    matchup: {
      sideA: { type: String, default: null },
      sideB: { type: String, default: null },
    },
    officialResult: {
      winningOptionId: { type: String, default: null },
      numericValue: { type: Number, default: null },
      label: { type: String, default: null },
      source: { type: String, default: 'host_entered' },
      evidence: { type: String, default: null },
      evidenceUrl: { type: String, default: null },
      submittedAt: { type: Date, default: null },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    resolution: {
      totalEntries: { type: Number, default: 0 },
      correctCount: { type: Number, default: 0 },
      totalPayoutSavvy: { type: Number, default: 0 },
      awardedAt: { type: Date, default: null },
      payoutComplete: { type: Boolean, default: false },
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyPredictionSchema.index({ eventId: 1, status: 1, locksAt: 1 });
savvyPredictionSchema.index({ eventId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyPrediction', savvyPredictionSchema);
