const mongoose = require('mongoose');

/**
 * Throttle + audit for Savvy Shop engagement (views / clicks / saves).
 * TTL trims old rows so spam tables do not grow forever.
 */
const savvyShopEngagementLogSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavvyShopProduct',
      required: true,
      index: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavvyShop',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['view', 'click', 'save'], required: true },
    fpHash: { type: String, required: true, index: true },
    /** Optional campaign hashtag slug (savvyfinds, savvyflip, savvyshop). */
    campaignTag: { type: String, default: '', trim: true, lowercase: true, maxlength: 32 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

savvyShopEngagementLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1209600 }); // 14d
savvyShopEngagementLogSchema.index({ productId: 1, type: 1, fpHash: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyShopEngagementLog', savvyShopEngagementLogSchema);
