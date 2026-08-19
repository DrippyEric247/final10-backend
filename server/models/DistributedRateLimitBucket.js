const mongoose = require('mongoose');

const distributedRateLimitBucketSchema = new mongoose.Schema(
  {
    bucketKey: { type: String, required: true, index: true },
    windowStart: { type: Date, required: true },
    windowMs: { type: Number, required: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

distributedRateLimitBucketSchema.index({ bucketKey: 1, windowStart: 1 }, { unique: true });
distributedRateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('DistributedRateLimitBucket', distributedRateLimitBucketSchema);
