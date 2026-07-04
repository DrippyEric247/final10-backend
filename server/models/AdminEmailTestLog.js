const mongoose = require('mongoose');

const adminEmailTestLogSchema = new mongoose.Schema(
  {
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    recipientEmail: { type: String, required: true, index: true },
    recipientUsername: { type: String, default: '' },
    sentByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    sentByEmail: { type: String, default: '' },
    templateKey: { type: String, required: true, index: true },
    templateLabel: { type: String, default: '' },
    subject: { type: String, default: '' },
    deliveryId: { type: String, default: '', index: true },
    status: {
      type: String,
      enum: ['sent', 'failed', 'log_only'],
      default: 'sent',
      index: true,
    },
    provider: { type: String, default: '' },
    reason: { type: String, default: '' },
    messageId: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminEmailTestLog', adminEmailTestLogSchema);
