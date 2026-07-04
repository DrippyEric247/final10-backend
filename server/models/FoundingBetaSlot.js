const mongoose = require('mongoose');

const foundingBetaSlotSchema = new mongoose.Schema(
  {
    slot: { type: Number, required: true, unique: true, min: 1, max: 100 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    username: { type: String, default: '' },
    joinedAt: { type: Date, default: null },
    missionsCompleted: { type: Number, default: 0 },
    programCompleted: { type: Boolean, default: false },
    programCompletedAt: { type: Date, default: null },
    legacyRewardsGranted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FoundingBetaSlot', foundingBetaSlotSchema);
