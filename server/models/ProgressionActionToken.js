const mongoose = require('mongoose');

/**
 * One-time tokens tied to server-confirmed bid flows (and optional win intent).
 */
const progressionActionTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    listingId: { type: String, required: true, index: true },
    purpose: { type: String, enum: ['bid_placed', 'auction_won'], required: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

progressionActionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProgressionActionToken', progressionActionTokenSchema);
