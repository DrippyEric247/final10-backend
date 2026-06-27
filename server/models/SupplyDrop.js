const mongoose = require('mongoose');

const supplyDropSchema = new mongoose.Schema(
  {
    dropId: { type: String, required: true, unique: true, index: true },
    scope: { type: String, enum: ['user', 'global'], default: 'user' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    source: {
      type: String,
      enum: ['admin', 'scoutSupport', 'scheduler', 'push', 'test'],
      default: 'admin',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rewardDef: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    claims: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          claimedAt: { type: Date, default: Date.now },
          rewardId: String,
          rewardLabel: String,
          rewardPayload: mongoose.Schema.Types.Mixed,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

supplyDropSchema.index({ active: 1, expiresAt: 1 });
supplyDropSchema.index({ scope: 1, userId: 1, active: 1 });

module.exports = mongoose.model('SupplyDrop', supplyDropSchema);
