const mongoose = require('mongoose');

const savvyShopProductSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavvyShop',
      required: true,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    kind: {
      type: String,
      enum: ['final10_flip', 'external_link'],
      default: 'external_link',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, default: '', trim: true, maxlength: 200 },
    imageUrl: { type: String, default: '' },
    currency: { type: String, default: 'USD', trim: true, uppercase: true, maxlength: 8 },
    displayPrice: { type: Number, default: 0 },
    estimatedProfit: { type: Number, default: null },
    flipScore: { type: Number, default: null },
    /** Cached ceiling for UI; recomputed on write when flipScore set. */
    savvyPotentialEstimate: { type: Number, default: null },
    dealUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    marketplaceItemId: { type: String, default: '', trim: true, maxlength: 64 },
    hashtags: [{ type: String, trim: true, maxlength: 48 }],
    whyBuy: { type: String, default: '', trim: true, maxlength: 4000 },
    /** Reserved for short video / embed (V1 unused). */
    videoUrl: { type: String, default: '', trim: true, maxlength: 2048 },

    engagement: {
      viewCount: { type: Number, default: 0 },
      clickCount: { type: Number, default: 0 },
      saveCount: { type: Number, default: 0 },
    },
    /** One-time creator reward keys, e.g. views_100, content_v1, sale_v1, high_flip, viral */
    milestonesGranted: [{ type: String, maxlength: 48 }],
  },
  { timestamps: true }
);

savvyShopProductSchema.index({ shop: 1, sortOrder: 1 });

module.exports = mongoose.model('SavvyShopProduct', savvyShopProductSchema);
