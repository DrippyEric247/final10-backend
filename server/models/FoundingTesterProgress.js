const mongoose = require('mongoose');

const missionRecordSchema = new mongoose.Schema(
  {
    missionId: { type: String, required: true },
    taskAttestedAt: { type: Date, default: null },
    taskVerified: { type: Boolean, default: false },
    feedback: { type: String, default: '' },
    feedbackLength: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    completionDayKey: { type: String, default: '' },
    savvyGranted: { type: Number, default: 0 },
    xpGranted: { type: Number, default: 0 },
  },
  { _id: false }
);

const foundingTesterProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },
    startedAt: { type: Date, default: Date.now },
    missionRecords: { type: [missionRecordSchema], default: [] },
    grandRewardGrantedAt: { type: Date, default: null },
    programCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FoundingTesterProgress', foundingTesterProgressSchema);
