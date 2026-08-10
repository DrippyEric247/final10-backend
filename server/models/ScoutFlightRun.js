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

    /** Score before any Nuke multiplier — the figure anti-cheat rate-limits. */
    baseScore: { type: Number, default: null },

    /** Admin/dev QA runs — visuals allowed, zero real payouts or permanent stats. */
    isTestRun: { type: Boolean, default: false, index: true },

    /** Lightweight cumulative gameplay evidence from server-validated heartbeats. */
    evidence: {
      lastHeartbeatAt: { type: Date, default: null },
      lastSequence: { type: Number, default: -1 },
      heartbeatCount: { type: Number, default: 0 },
      maxObstaclesPassed: { type: Number, default: 0 },
      maxScoreSeen: { type: Number, default: 0 },
      maxBaseScoreSeen: { type: Number, default: 0 },
      maxNukeMultiplierSeen: { type: Number, default: 1 },
      maxRunMultiplierSeen: { type: Number, default: 1 },
      largestGapMs: { type: Number, default: 0 },
      gapCount: { type: Number, default: 0 },
      rejectedHeartbeats: { type: Number, default: 0 },
      lastScoreIncreaseAt: { type: Date, default: null },
    },

    /** Server-verified Nuke Flight Streak outcome for this run. */
    nuke: {
      triggered: { type: Boolean, default: false },
      survivalMs: { type: Number, default: 0 },
      highestMultiplier: { type: Number, default: 0 },
      bonusScore: { type: Number, default: 0 },
      obstaclesEscaped: { type: Number, default: 0 },
      structuresDestroyed: { type: Number, default: 0 },
      bonusSavvy: { type: Number, default: 0 },
      bonusGranted: { type: Boolean, default: false },
      rejected: { type: Boolean, default: false },
      rejectedReason: { type: String, default: null },
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

scoutFlightRunSchema.index({ userId: 1, status: 1, expiresAt: -1 });
scoutFlightRunSchema.index({ status: 1, mode: 1, score: -1, completedAt: 1 });
scoutFlightRunSchema.index({ seasonId: 1, status: 1, score: -1 });

module.exports = mongoose.model('ScoutFlightRun', scoutFlightRunSchema);
