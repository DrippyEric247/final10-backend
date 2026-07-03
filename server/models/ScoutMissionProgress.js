const mongoose = require('mongoose');

const scoutMissionProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    missionId: { type: String, required: true },
    periodKey: { type: String, required: true },
    progress: { type: Number, default: 0 },
    target: { type: Number, required: true },
    completedAt: { type: Date, default: null },
    lastTrigger: { type: String, default: null },
  },
  { timestamps: true }
);

scoutMissionProgressSchema.index({ userId: 1, missionId: 1, periodKey: 1 }, { unique: true });
scoutMissionProgressSchema.index({ userId: 1, completedAt: 1 });

module.exports = mongoose.model('ScoutMissionProgress', scoutMissionProgressSchema);
