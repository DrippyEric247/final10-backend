const mongoose = require('mongoose');

const CLAIM_TYPES = Object.freeze([
  'join',
  'checkpoint',
  'live_code',
  'competition',
  'host_award',
  'completion',
]);

const savvyWatchClaimSchema = new mongoose.Schema(
  {
    claimId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, default: null, index: true },
    claimType: { type: String, enum: CLAIM_TYPES, required: true, index: true },
    checkpointId: { type: String, default: null },
    liveCodeId: { type: String, default: null },
    competitionId: { type: String, default: null },
    entryId: { type: String, default: null },
    savvyAmount: { type: Number, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    transactionId: { type: String, default: null },
    status: { type: String, enum: ['pending', 'completed', 'denied', 'failed'], default: 'pending' },
    denialReason: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyWatchClaimSchema.index({ eventId: 1, userId: 1, claimType: 1, checkpointId: 1 });
savvyWatchClaimSchema.index({ eventId: 1, userId: 1, liveCodeId: 1 });
savvyWatchClaimSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SavvyWatchClaim', savvyWatchClaimSchema);
module.exports.CLAIM_TYPES = CLAIM_TYPES;
