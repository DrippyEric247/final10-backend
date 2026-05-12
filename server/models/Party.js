const mongoose = require('mongoose');

/**
 * Party — "Squad Sync" v1 cooperative earning group.
 *
 * Boost math (see services/partyService.js for the authoritative compute):
 *   teamAverage   = average(personalMultiplier of active members)
 *   formulaBoost  = clamp((teamAverage - 1.0) * 0.30, 0.10, 0.50)
 *   energyCap     = step(energy / MAX_ENERGY) in { 0, 0.10, 0.20, 0.35, 0.50 }
 *   partyBoost    = min(formulaBoost, energyCap)   // only while session is active
 *   final         = min(3.50, personalMultiplier + partyBoost)
 *
 * A party only applies a boost while status === 'active' AND at least 2 members
 * are considered active (recent valid event within the active-window).
 */
const partySchema = new mongoose.Schema(
  {
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    memberUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    name: { type: String, trim: true, default: 'Squad' },

    maxMembers: { type: Number, default: 5, min: 2, max: 5 },

    status: {
      type: String,
      enum: ['idle', 'active', 'cooldown', 'ended'],
      default: 'idle',
      index: true,
    },

    /** When the party group was created (members can join even when idle). */
    createdAt: { type: Date, default: Date.now },

    /** Logical expiry of the group itself (stale lobbies auto-end). */
    expiresAt: { type: Date, default: null },

    /** Start of the current active session, if any. */
    sessionStartedAt: { type: Date, default: null },

    /** End of the current active session, or null while active. */
    sessionEndedAt: { type: Date, default: null },

    /**
     * Denormalized cached partyBoost (0..0.50) from the last compute.
     * The authoritative value is always re-derived by partyService.computeState.
     */
    currentPartyBoost: { type: Number, default: 0, min: 0, max: 0.5 },

    /** Accumulated Sync Energy during the current session (0..MAX_ENERGY). */
    energy: { type: Number, default: 0, min: 0 },

    /** Highest boost seen during the current session (for summary). */
    peakBoost: { type: Number, default: 0, min: 0, max: 0.5 },

    /** Cooldown gate — members can't start a new session until this passes. */
    cooldownUntil: { type: Date, default: null },

    /**
     * Anti-abuse: per-session counters keyed by userId string.
     * Values are plain numbers — how many "boosted" actions each user has
     * contributed in the current session. Wiped on session start.
     */
    sessionActionCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    /**
     * If set, the party's boost is disabled for the remainder of this session
     * (e.g. suspicious-activity trip). Reset when a new session starts.
     */
    boostDisabled: { type: Boolean, default: false },
    boostDisabledReason: { type: String, default: null },
  },
  { timestamps: true }
);

partySchema.index({ memberUserIds: 1, status: 1 });

partySchema.methods.isMember = function isMember(userId) {
  const id = String(userId);
  return (this.memberUserIds || []).some((m) => String(m) === id);
};

partySchema.methods.isFull = function isFull() {
  return (this.memberUserIds || []).length >= (this.maxMembers || 5);
};

module.exports = mongoose.model('Party', partySchema);
