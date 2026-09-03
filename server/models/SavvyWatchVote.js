const mongoose = require('mongoose');

const savvyWatchVoteSchema = new mongoose.Schema(
  {
    voteId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    competitionId: { type: String, required: true, index: true },
    entryId: { type: String, required: true, index: true },
    voterUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    invalidated: { type: Boolean, default: false },
    invalidationReason: { type: String, default: null },
  },
  { timestamps: true }
);

savvyWatchVoteSchema.index({ competitionId: 1, voterUserId: 1 }, { unique: true });
savvyWatchVoteSchema.index({ competitionId: 1, entryId: 1 });

module.exports = mongoose.model('SavvyWatchVote', savvyWatchVoteSchema);
