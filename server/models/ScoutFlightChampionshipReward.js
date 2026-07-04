const mongoose = require('mongoose');

const scoutFlightChampionshipRewardSchema = new mongoose.Schema(
  {
    seasonId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rank: { type: Number, required: true },
    score: { type: Number, default: 0 },
    runsSubmitted: { type: Number, default: 0 },
    savvyGranted: { type: Number, default: 0 },
    savvyIdempotencyKey: { type: String, required: true, unique: true, index: true },
    cosmeticsGranted: [
      {
        itemId: String,
        type: String,
      },
    ],
    badgeId: { type: String, default: null },
    title: { type: String, default: null },
    isBetaSeason: { type: Boolean, default: false },
    suspiciousFlagged: { type: Boolean, default: false },
    disqualified: { type: Boolean, default: false },
    grantedAt: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

scoutFlightChampionshipRewardSchema.index({ seasonId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ScoutFlightChampionshipReward', scoutFlightChampionshipRewardSchema);
