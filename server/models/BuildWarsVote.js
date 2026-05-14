const mongoose = require('mongoose');

const buildWarsVoteSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, index: true },
    entry: { type: mongoose.Schema.Types.ObjectId, ref: 'BuildWarsEntry', required: true, index: true },
    voter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

buildWarsVoteSchema.index({ eventId: 1, entry: 1, voter: 1 }, { unique: true });

module.exports = mongoose.model('BuildWarsVote', buildWarsVoteSchema);
