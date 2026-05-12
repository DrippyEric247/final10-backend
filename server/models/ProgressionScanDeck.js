const mongoose = require('mongoose');

/**
 * Listings recently returned to this user from trusted eBay search/final10 responses.
 * Used to validate auction_scanned / auction_won context in production.
 */
const progressionScanDeckSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    listingIds: [{ type: String }],
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

progressionScanDeckSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ProgressionScanDeck', progressionScanDeckSchema);
