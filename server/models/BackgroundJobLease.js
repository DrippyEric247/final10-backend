const mongoose = require('mongoose');

const backgroundJobLeaseSchema = new mongoose.Schema(
  {
    jobKey: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    acquiredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

backgroundJobLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BackgroundJobLease', backgroundJobLeaseSchema);
