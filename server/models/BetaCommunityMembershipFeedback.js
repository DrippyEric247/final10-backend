const mongoose = require('mongoose');

const betaCommunityMembershipFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    username: { type: String, default: '' },
    type: { type: String, enum: ['suggestion', 'vote_intent'], default: 'suggestion' },
    message: { type: String, required: true, maxlength: 4000 },
    dayKey: { type: String, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'BetaCommunityMembershipFeedback',
  betaCommunityMembershipFeedbackSchema
);
