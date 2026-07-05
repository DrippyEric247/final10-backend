/**
 * Emergency referral audit trail — event-sourced logs for manual Savvy recovery.
 * Complements legacy ReferralLog (accepted/blocked/capped outcomes).
 */
const mongoose = require('mongoose');
const {
  REFERRAL_TRACKING_EVENT_TYPES,
  REFERRAL_TRACKING_GRANT_STATUSES,
} = require('../config/referralTracking');

const ReferralTrackingLogSchema = new mongoose.Schema(
  {
    referralCode: { type: String, required: true, index: true, trim: true },
    referrerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    referrerEmail: { type: String, trim: true, lowercase: true },
    referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    referredEmail: { type: String, trim: true, lowercase: true },
    eventType: {
      type: String,
      enum: REFERRAL_TRACKING_EVENT_TYPES,
      required: true,
      index: true,
    },
    pointsExpected: { type: Number, default: 5000 },
    grantStatus: {
      type: String,
      enum: REFERRAL_TRACKING_GRANT_STATUSES,
      default: 'pending',
      index: true,
    },
    failureReason: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    manualGranted: { type: Boolean, default: false, index: true },
    manualGrantedAt: { type: Date },
    manualGrantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    savvyTransactionKey: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

ReferralTrackingLogSchema.index({ grantStatus: 1, createdAt: -1 });
ReferralTrackingLogSchema.index({ referredUserId: 1, eventType: 1, grantStatus: 1 });
ReferralTrackingLogSchema.index(
  { _id: 1, manualGranted: 1 },
  { name: 'manual_grant_lookup' }
);

module.exports = mongoose.model('ReferralTrackingLog', ReferralTrackingLogSchema);
