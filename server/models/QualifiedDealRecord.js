const mongoose = require('mongoose');

const qualifiedDealRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceKey: { type: String, required: true },
    sourceType: { type: String, required: true },
    dealId: { type: String, required: true },
    category: { type: String, default: null },
    categoryRaw: { type: String, default: null },
    countedForStreak: { type: Boolean, default: false },
    skipReason: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

qualifiedDealRecordSchema.index({ userId: 1, sourceKey: 1 }, { unique: true });
qualifiedDealRecordSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('QualifiedDealRecord', qualifiedDealRecordSchema);
