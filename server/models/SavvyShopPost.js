const mongoose = require('mongoose');

/**
 * Lightweight creator posts tied to a shop product (Savvy Content Layer — not a full social app).
 */
const savvyShopPostSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavvyShop',
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavvyShopProduct',
      required: true,
      index: true,
    },
    caption: { type: String, required: true, trim: true, maxlength: 2000 },
    imageUrl: { type: String, default: '', trim: true, maxlength: 2048 },
    hashtags: [{ type: String, trim: true, lowercase: true, maxlength: 48 }],
    /** Snapshot for “High Flip Score” feed sort without extra joins. */
    productFlipScoreAtPost: { type: Number, default: null },
    engagement: {
      viewCount: { type: Number, default: 0 },
      likeCount: { type: Number, default: 0 },
      saveCount: { type: Number, default: 0 },
    },
    milestonesGranted: [{ type: String, maxlength: 48 }],
  },
  { timestamps: true }
);

savvyShopPostSchema.index({ shop: 1, createdAt: -1 });
savvyShopPostSchema.index({ shop: 1, productFlipScoreAtPost: -1, createdAt: -1 });

module.exports = mongoose.model('SavvyShopPost', savvyShopPostSchema);
