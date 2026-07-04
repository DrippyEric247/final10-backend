const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    emoji: { type: String, default: '✨' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const shippedItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    shippedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const betaCommunityConfigSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'default', unique: true },
    rewards: {
      voteSavvy: { type: Number, default: 15 },
      reviewSavvy: { type: Number, default: 25 },
      dailyReviewLimit: { type: Number, default: 1 },
    },
    stats: {
      bugsFixed: { type: Number, default: 47 },
      suggestionsImplemented: { type: Number, default: 12 },
    },
    topics: { type: [topicSchema], default: [] },
    shippedItems: { type: [shippedItemSchema], default: [] },
    scoutLines: {
      type: [String],
      default: [
        'Operator, every vote helps improve the Savvy Universe.',
        'Your feedback today builds tomorrow\'s features.',
        'Founding Testers shape what ships next — cast your vote.',
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BetaCommunityConfig', betaCommunityConfigSchema);
