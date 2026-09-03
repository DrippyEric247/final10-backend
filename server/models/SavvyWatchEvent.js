const mongoose = require('mongoose');
const { EVENT_STATUSES } = require('../config/savvyWatchConfig');

const savvyWatchEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    platform: { type: String, default: 'youtube', index: true },
    platformStreamId: { type: String, default: null },
    platformUrl: { type: String, default: null },
    youtubeVideoId: { type: String, default: null },
    youtubeChannelId: { type: String, default: null },
    status: { type: String, enum: EVENT_STATUSES, default: 'draft', index: true },
    scheduledStartAt: { type: Date, default: null },
    actualStartAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    rewardBudget: { type: Number, default: 0 },
    budgetAllocated: { type: Number, default: 0 },
    budgetClaimed: { type: Number, default: 0 },
    rewardRules: {
      checkpoints: { type: [mongoose.Schema.Types.Mixed], default: [] },
      maxSavvyPerViewer: { type: Number, default: 100 },
      label: { type: String, default: 'Verified Event Participation' },
    },
    competitionRules: { type: mongoose.Schema.Types.Mixed, default: {} },
    viewerCap: { type: Number, default: null },
    streamCategory: { type: String, default: 'general', index: true },
    attributionCounts: { type: Map, of: Number, default: {} },
    hostDisplayName: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyWatchEventSchema.index({ status: 1, scheduledStartAt: 1 });
savvyWatchEventSchema.index({ creatorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyWatchEvent', savvyWatchEventSchema);
