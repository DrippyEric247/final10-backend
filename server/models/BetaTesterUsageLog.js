const mongoose = require('mongoose');

const betaTesterUsageLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

betaTesterUsageLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('BetaTesterUsageLog', betaTesterUsageLogSchema);
