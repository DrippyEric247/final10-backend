const mongoose = require('mongoose');
const {
  COMPETITION_TYPES,
  VOTING_MODES,
  COMPETITION_STATUSES,
} = require('../config/savvyWatchConfig');

const savvyWatchCompetitionSchema = new mongoose.Schema(
  {
    competitionId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    slug: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: COMPETITION_TYPES, default: 'custom' },
    status: { type: String, enum: COMPETITION_STATUSES, default: 'draft', index: true },
    votingMode: { type: String, enum: VOTING_MODES, default: 'community' },
    hostWeight: { type: Number, default: 0.5 },
    entryStartsAt: { type: Date, default: null },
    entryEndsAt: { type: Date, default: null },
    votingStartsAt: { type: Date, default: null },
    votingEndsAt: { type: Date, default: null },
    maxEntriesPerUser: { type: Number, default: 1 },
    voteLimitPerUser: { type: Number, default: 1 },
    moderationRequired: { type: Boolean, default: true },
    eligibleMake: { type: String, default: null },
    rewardConfig: {
      winnerSavvy: { type: Number, default: 0 },
      runnerUpSavvy: { type: Number, default: 0 },
    },
    results: {
      winnerEntryId: { type: String, default: null },
      runnerUpEntryId: { type: String, default: null },
      communityVotes: { type: mongoose.Schema.Types.Mixed, default: {} },
      hostScore: { type: mongoose.Schema.Types.Mixed, default: {} },
      finalScores: { type: mongoose.Schema.Types.Mixed, default: {} },
      awardsGranted: { type: Boolean, default: false },
      lockedAt: { type: Date, default: null },
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyWatchCompetitionSchema.index({ eventId: 1, slug: 1 }, { unique: true });
savvyWatchCompetitionSchema.index({ eventId: 1, status: 1 });

module.exports = mongoose.model('SavvyWatchCompetition', savvyWatchCompetitionSchema);
