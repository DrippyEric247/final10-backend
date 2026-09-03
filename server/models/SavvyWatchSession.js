const mongoose = require('mongoose');
const { SESSION_STATUSES } = require('../config/savvyWatchConfig');

const savvyWatchSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    joinedAt: { type: Date, default: Date.now },
    lastPresenceAt: { type: Date, default: Date.now },
    lastHeartbeatAt: { type: Date, default: null },
    verifiedActiveSeconds: { type: Number, default: 0 },
    backgroundSince: { type: Date, default: null },
    savvyEarned: { type: Number, default: 0 },
    predictionSavvyEarned: { type: Number, default: 0 },
    predictionsSubmitted: { type: Number, default: 0 },
    checkpointClaims: { type: [String], default: [] },
    liveCodeClaims: { type: [String], default: [] },
    competitionVotes: { type: Number, default: 0 },
    competitionsEntered: { type: Number, default: 0 },
    joinSource: { type: String, default: 'unknown' },
    status: { type: String, enum: SESSION_STATUSES, default: 'active', index: true },
    deviceHint: { type: String, default: null },
    flaggedReason: { type: String, default: null },
  },
  { timestamps: true }
);

savvyWatchSessionSchema.index({ eventId: 1, userId: 1 }, { unique: true });
savvyWatchSessionSchema.index({ eventId: 1, status: 1, lastPresenceAt: -1 });

module.exports = mongoose.model('SavvyWatchSession', savvyWatchSessionSchema);
