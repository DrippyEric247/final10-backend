const mongoose = require("mongoose");

const businessOfferSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    businessName: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
    offerTitle: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["electronics", "gaming", "sneakers", "fashion", "home", "auto", "other"],
      required: true,
      index: true,
    },
    rewardAmount: { type: Number, required: true, min: 0 },
    dailyBudget: { type: Number, required: true, min: 1 },
    totalBudget: { type: Number, required: true, min: 1 },
    spent: { type: Number, default: 0, min: 0 },
    promotionTier: { type: String, enum: ["basic", "boosted", "featured"], default: "basic", index: true },
    sourceType: { type: String, enum: ["promoted", "featured"], default: "promoted" },
    status: { type: String, enum: ["active", "paused", "ended"], default: "active", index: true },
    verificationStatus: { type: String, enum: ["verified", "pending", "unverified"], default: "pending", index: true },
    pricingModel: {
      payPerClick: { enabled: { type: Boolean, default: true }, rate: { type: Number, default: 0.35 } },
      payPerClaim: { enabled: { type: Boolean, default: true }, rate: { type: Number, default: 1.25 } },
      featuredPlacement: { enabled: { type: Boolean, default: false }, dailyFee: { type: Number, default: 0 } },
    },
    stats: {
      views: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      claims: { type: Number, default: 0 },
      rewardsDistributed: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

businessOfferSchema.index({ ownerUserId: 1, status: 1, createdAt: -1 });

businessOfferSchema.methods.recomputeStats = function recomputeStats() {
  const clicks = Number(this.stats.clicks || 0);
  const claims = Number(this.stats.claims || 0);
  this.stats.conversionRate = clicks > 0 ? Number(((claims / clicks) * 100).toFixed(2)) : 0;
  return this;
};

module.exports = mongoose.model("BusinessOffer", businessOfferSchema);

