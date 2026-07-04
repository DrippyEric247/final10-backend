const mongoose = require('mongoose');

const scoutFlightRunSchema = new mongoose.Schema(
  {
    runId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mode: { type: String, enum: ['tournament'], default: 'tournament' },
    status: {
      type: String,
      enum: ['active', 'completed', 'expired', 'invalid', 'disqualified'],
      default: 'active',
      index: true,
    },
    seasonId: { type: String, default: null, index: true },
    ticketSpent: { type: Boolean, default: true },
    startTime: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    completedAt: { type: Date, default: null },
    score: { type: Number, default: null },
    savvyEarned: { type: Number, default: 0 },
    savvyGranted: { type: Boolean, default: false },
    submitIdempotencyKey: { type: String, default: null, index: true, sparse: true },
    suspicious: { type: Boolean, default: false },
    suspiciousReason: { type: String, default: null },
    elapsedMs: { type: Number, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

scoutFlightRunSchema.index({ userId: 1, status: 1, expiresAt: -1 });
scoutFlightRunSchema.index({ status: 1, mode: 1, score: -1, completedAt: 1 });
scoutFlightRunSchema.index({ seasonId: 1, status: 1, score: -1 });

module.exports = mongoose.model('ScoutFlightRun', scoutFlightRunSchema);
