const mongoose = require('mongoose');

const taskProgressEntrySchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    rewardGranted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const battlePassProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seasonId: { type: String, required: true, index: true },
    xp: { type: Number, default: 0 },
    /** Highest tier index reached (1-based tier number), denormalized for quick reads */
    tier: { type: Number, default: 0 },
    completedTaskIds: [{ type: String }],
    claimedRewardIds: [{ type: String }],
    taskProgress: [taskProgressEntrySchema],
    /** Savvy-leaderboard rank anchor for season climb missions (server-maintained). */
    seasonRankAnchor: { type: Number, default: null },
    lastKnownLeaderboardRank: { type: Number, default: null },
    /** Neon Hunt style premium track unlock (separate from membershipTier). */
    premiumUnlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

battlePassProgressSchema.index({ userId: 1, seasonId: 1 }, { unique: true });

module.exports = mongoose.model('BattlePassProgress', battlePassProgressSchema);
