const mongoose = require('mongoose');

const savvyShopPostEngagementLogSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavvyShopPost',
      required: true,
      index: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavvyShop',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['view', 'like', 'save', 'shop'], required: true },
    fpHash: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

savvyShopPostEngagementLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1209600 });
savvyShopPostEngagementLogSchema.index({ postId: 1, type: 1, fpHash: 1, createdAt: -1 });

module.exports = mongoose.model('SavvyShopPostEngagementLog', savvyShopPostEngagementLogSchema);
