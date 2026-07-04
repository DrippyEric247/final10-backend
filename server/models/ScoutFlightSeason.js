const mongoose = require('mongoose');

const championSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: '' },
    score: { type: Number, default: 0 },
    savvyEarned: { type: Number, default: 0 },
    callingCardId: { type: String, default: null },
    runId: { type: String, default: null },
    recordedAt: { type: Date, default: null },
  },
  { _id: false }
);

const scoutFlightSeasonSchema = new mongoose.Schema(
  {
    seasonId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    themeKey: { type: String, default: 'default' },
    theme: {
      bannerTitle: String,
      backgroundArtKey: String,
      musicKey: String,
      callingCardStyle: String,
      eventColor: String,
    },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'ended', 'finalized'],
      default: 'active',
      index: true,
    },
    isBetaSeason: { type: Boolean, default: false },
    champion: { type: championSchema, default: () => ({}) },
    finalizedAt: { type: Date, default: null },
    rewardCount: { type: Number, default: 0 },
    flaggedRunCount: { type: Number, default: 0 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

scoutFlightSeasonSchema.index({ status: 1, endAt: 1 });

module.exports = mongoose.model('ScoutFlightSeason', scoutFlightSeasonSchema);
