const mongoose = require('mongoose');

const { NUKE_PROGRESS_STATUSES } = require('../config/nukeCollection');

/**
 * Secret Nuke requirement progress — server-authoritative only.
 * Unique per user + requirement (+ testData flag for admin simulations).
 */
const nukeProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requirementId: { type: String, required: true, index: true },
    currentValue: { type: Number, default: 0, min: 0 },
    targetValue: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: NUKE_PROGRESS_STATUSES,
      default: 'not_started',
    },
    firstProgressAt: { type: Date, default: null },
    lastProgressAt: { type: Date, default: null },
    qualifiedAt: { type: Date, default: null },
    unlockedAt: { type: Date, default: null },
    /** When true, row is admin simulation — never counts toward production stats. */
    testData: { type: Boolean, default: false, index: true },
    flagged: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['verified', 'pending', 'suspicious'],
      default: 'verified',
    },
    lastSource: { type: String, default: 'system', maxlength: 64 },
    lastVerificationMethod: { type: String, default: 'server_event', maxlength: 64 },
  },
  { timestamps: true }
);

nukeProgressSchema.index(
  { userId: 1, requirementId: 1, testData: 1 },
  { unique: true }
);

module.exports = mongoose.model('NukeProgress', nukeProgressSchema);
