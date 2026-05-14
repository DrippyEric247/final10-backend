const mongoose = require('mongoose');

/**
 * Creator Savvy Shop (V1) — storefront metadata, no inventory.
 */
const savvyShopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    /** URL segment: /shop/:slug */
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/,
      index: true,
    },
    storeName: { type: String, required: true, trim: true, maxlength: 80 },
    brandTagline: { type: String, default: '', trim: true, maxlength: 120 },
    bio: { type: String, default: '', trim: true, maxlength: 2000 },
    /** Shown commission % for transparency (V1 — settlement rails later). */
    defaultCommissionPct: { type: Number, default: 5, min: 0, max: 50 },
    /** Savvy awarded through shop-specific actions (posts, etc.). */
    totalShopSavvyEarned: { type: Number, default: 0 },
    /** Curated badges: top_seller | trending_creator */
    badges: [{ type: String, enum: ['top_seller', 'trending_creator'] }],
    published: { type: Boolean, default: false },
    /** Denormalized from owner subscription — for public badges / sort (sync on shop save). */
    creatorAccessBand: {
      type: String,
      enum: ['free', 'premium', 'elite'],
      default: 'free',
      index: true,
    },
  },
  { timestamps: true }
);

savvyShopSchema.index({ published: 1, slug: 1 });

module.exports = mongoose.model('SavvyShop', savvyShopSchema);
