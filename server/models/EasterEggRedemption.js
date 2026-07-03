const mongoose = require('mongoose');

const easterEggRedemptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    pointsAwarded: { type: Number, required: true },
    savvyTransactionKey: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

easterEggRedemptionSchema.index({ userId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('EasterEggRedemption', easterEggRedemptionSchema);
