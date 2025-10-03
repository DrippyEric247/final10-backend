// server/models/ReferralLog.js
const mongoose = require('mongoose');

const ReferralLogSchema = new mongoose.Schema(
  {
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    refereedId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ip: { type: String },
    ua: { type: String },
    status: { 
      type: String, 
      enum: ['accepted', 'blocked', 'capped'], 
      required: true 
    },
    reason: { type: String }
  },
  { timestamps: true } // automatically adds createdAt + updatedAt
);

// ❌ Don't add ReferralLogSchema.index({ createdAt: 1 });
// timestamps already creates it → that’s what triggered your warning

module.exports = mongoose.model('ReferralLog', ReferralLogSchema);


