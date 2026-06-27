const mongoose = require('mongoose');

const liveEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['SAVVY_SALE'], required: true, index: true },
    startAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: {
      type: String,
      enum: ['admin', 'scoutSupport', 'futureRandomEvent'],
      default: 'admin',
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

liveEventSchema.index({ type: 1, active: 1, expiresAt: -1 });

module.exports = mongoose.model('LiveEvent', liveEventSchema);
