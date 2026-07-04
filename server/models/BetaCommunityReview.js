const mongoose = require('mongoose');

const betaCommunityReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayKey: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    enjoyed: { type: String, default: '' },
    improve: { type: String, default: '' },
    reportBug: { type: String, default: '' },
    savvyGranted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

betaCommunityReviewSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

module.exports = mongoose.model('BetaCommunityReview', betaCommunityReviewSchema);
