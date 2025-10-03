// server/models/PointsLedger.js
const mongoose = require('mongoose');

const PointsLedgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['earn', 'redeem'], required: true },
  amount: { type: Number, required: true },
  source: { type: String },       // e.g. "signup_bonus", "auction_redeem"
  refId: { type: String },        // optional reference (auction id, etc.)
  idempotencyKey: { type: String, index: true, unique: true },
}, { timestamps: true });

module.exports = mongoose.model('PointsLedger', PointsLedgerSchema);


