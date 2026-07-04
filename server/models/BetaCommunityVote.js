const mongoose = require('mongoose');

const betaCommunityVoteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topicId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

betaCommunityVoteSchema.index({ userId: 1, topicId: 1 }, { unique: true });

module.exports = mongoose.model('BetaCommunityVote', betaCommunityVoteSchema);
