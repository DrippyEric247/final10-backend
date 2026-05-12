const mongoose = require('mongoose');

const securityAuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    ip: { type: String, default: null },
    path: { type: String, default: null },
    method: { type: String, default: null },
    severity: { type: String, enum: ['info', 'warn', 'critical'], default: 'info' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

securityAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('SecurityAuditLog', securityAuditLogSchema);
