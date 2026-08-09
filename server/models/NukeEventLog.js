const mongoose = require('mongoose');

const { NUKE_EVENT_TYPES } = require('../config/nukeCollection');

/** Append-only Nuke audit trail for admin monitoring. */
const nukeEventLogSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requirementId: { type: String, default: null, index: true },
    eventType: { type: String, enum: NUKE_EVENT_TYPES, required: true, index: true },
    previousValue: { type: Number, default: null },
    newValue: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
    source: { type: String, default: 'system', maxlength: 64 },
    verificationMethod: { type: String, default: 'server_event', maxlength: 64 },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    testData: { type: Boolean, default: false, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: false }
);

nukeEventLogSchema.index({ userId: 1, timestamp: -1 });
nukeEventLogSchema.index({ eventType: 1, timestamp: -1 });

module.exports = mongoose.model('NukeEventLog', nukeEventLogSchema);
