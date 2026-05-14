const mongoose = require('mongoose');

/**
 * Seller's resale listing tied to flip / assistant metadata for Savvy Points rewards.
 */
const flipTrackedListingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerListingId: { type: String, required: true, trim: true },
    listingType: { type: String, enum: ['ebay', 'custom'], default: 'ebay' },
    dealItemId: { type: String, default: '' },
    promotedListingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PromotedListing',
      default: null,
    },
    buyPrice: { type: Number, default: 0 },
    suggestedMin: { type: Number, default: 0 },
    suggestedMax: { type: Number, default: 0 },
    predictedDaysToSell: { type: Number, default: 14 },
    flipScore: { type: Number, default: null },
    fromAiSuggestion: { type: Boolean, default: false },
    listedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['open', 'sold', 'void'], default: 'open' },
    cancelledEarly: { type: Boolean, default: false },
    listingBonusApplied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

flipTrackedListingSchema.index({ user: 1, sellerListingId: 1 }, { unique: true });
flipTrackedListingSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('FlipTrackedListing', flipTrackedListingSchema);
