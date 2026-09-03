const mongoose = require('mongoose');

const LIVE_CODE_STATUSES = Object.freeze(['draft', 'active', 'expired', 'cancelled']);

const savvyWatchLiveCodeSchema = new mongoose.Schema(
  {
    liveCodeId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    code: { type: String, required: true, index: true },
    label: { type: String, default: 'SAVVY CHECK' },
    reward: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    maxClaims: { type: Number, default: null },
    perUserLimit: { type: Number, default: 1 },
    claimCount: { type: Number, default: 0 },
    status: { type: String, enum: LIVE_CODE_STATUSES, default: 'draft', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

savvyWatchLiveCodeSchema.index({ eventId: 1, code: 1 }, { unique: true });
savvyWatchLiveCodeSchema.index({ eventId: 1, status: 1, expiresAt: 1 });

module.exports = mongoose.model('SavvyWatchLiveCode', savvyWatchLiveCodeSchema);
module.exports.LIVE_CODE_STATUSES = LIVE_CODE_STATUSES;
