const mongoose = require('mongoose');
const crypto = require('crypto');

const savvyTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomUUID(),
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'pending',
    },
    rewardType: { type: String, default: null },
    note: { type: String, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

savvyTransactionSchema.index({ userId: 1, createdAt: -1 });
savvyTransactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SavvyTransaction', savvyTransactionSchema);
