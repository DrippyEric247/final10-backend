// server/models/ReferralLog.js
const mongoose = require('mongoose');

const ReferralLogSchema = new mongoose.Schema(
  {
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refereedId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ip: { type: String },
    ua: { type: String },
    status: {
      type: String,
      enum: ['accepted', 'blocked', 'capped'],
      required: true,
    },
    reason: { type: String },
  },
  { timestamps: true }
);

ReferralLogSchema.index({ referrerId: 1, createdAt: -1 });
ReferralLogSchema.index(
  { refereedId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'accepted' },
    name: 'one_accepted_referral_per_referee',
  }
);

module.exports = mongoose.model('ReferralLog', ReferralLogSchema);
