const mongoose = require('mongoose');

const contractProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contractId: { type: String, required: true },
    appId: { type: String, required: true, default: 'final10' },
    scope: { type: String, enum: ['app', 'universe'], default: 'app' },
    periodKey: { type: String, required: true },
    progress: { type: Number, default: 0 },
    target: { type: Number, required: true },
    completedAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
    lastTrigger: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

contractProgressSchema.index({ userId: 1, contractId: 1, periodKey: 1 }, { unique: true });
contractProgressSchema.index({ userId: 1, completedAt: 1 });
contractProgressSchema.index({ userId: 1, claimedAt: 1 });

module.exports = mongoose.model('ContractProgress', contractProgressSchema);
