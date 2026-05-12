const mongoose = require('mongoose');

const battlePassEventLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    matchedTaskIds: [{ type: String }],
    grantedRewards: [{ type: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true }
);

battlePassEventLogSchema.index({ userId: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model('BattlePassEventLog', battlePassEventLogSchema);
