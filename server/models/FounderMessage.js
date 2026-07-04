const mongoose = require('mongoose');

const founderMessageSchema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    subject: {
      type: String,
      required: true,
      enum: [
        'general_feedback',
        'investment_inquiry',
        'partnership',
        'retailer',
        'media',
        'bug_report',
        'other',
      ],
    },
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, maxlength: 254, index: true },
    company: { type: String, default: '', maxlength: 120 },
    message: { type: String, required: true, maxlength: 5000 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    username: { type: String, default: '' },
    ipHash: { type: String, default: '', index: true },
    screenshot: {
      mimeType: { type: String, default: null },
      size: { type: Number, default: 0 },
      data: { type: Buffer, default: null },
    },
    status: {
      type: String,
      enum: ['received', 'reviewed', 'archived'],
      default: 'received',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FounderMessage', founderMessageSchema);
