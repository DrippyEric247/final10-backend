const mongoose = require('mongoose');

const buildWarsEntrySchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectAlert: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectAlert',
      required: true,
    },
    buildType: { type: String, default: 'Custom build' },
    savingsUsd: { type: Number, default: 0 },
    trustBlend: { type: Number, default: 0 },
    linkedAlerts: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
    savingsScore: { type: Number, default: 0 },
    smartBuildScore: { type: Number, default: 0 },
    trustScore: { type: Number, default: 0 },
    voteScore: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0, index: true },
    communityVotes: { type: Number, default: 0 },
    savvyPointsAwarded: { type: Number, default: 0 },
    participantRewardGranted: { type: Boolean, default: false },
    rankRewardClaimed: { type: Boolean, default: false },
    rankRewardTier: { type: String, enum: ['none', 'top1', 'top10', 'lucky'], default: 'none' },
    luckyRewardGranted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

buildWarsEntrySchema.index({ eventId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('BuildWarsEntry', buildWarsEntrySchema);
