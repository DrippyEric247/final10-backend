const mongoose = require('mongoose');

const savvyCoreAuditSchema = new mongoose.Schema(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    appId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String, default: null },
    amount: { type: Number, default: null },
    source: { type: String, default: null },
    idempotencyKey: { type: String, default: null, index: true },
    status: { type: String, enum: ['completed', 'duplicate', 'failed'], default: 'completed' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyCoreAuditSchema.index({ userId: 1, appId: 1, createdAt: -1 });
savvyCoreAuditSchema.index({ idempotencyKey: 1, action: 1 });

module.exports = mongoose.model('SavvyCoreAudit', savvyCoreAuditSchema);
