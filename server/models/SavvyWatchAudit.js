const mongoose = require('mongoose');

const savvyWatchAuditSchema = new mongoose.Schema(
  {
    auditId: { type: String, required: true, unique: true, index: true },
    eventId: { type: String, required: true, index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyWatchAuditSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyWatchAudit', savvyWatchAuditSchema);
