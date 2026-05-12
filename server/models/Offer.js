const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    image: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    marketValue: { type: Number, required: true, min: 0 },
    savings: { type: Number, default: 0, min: 0 },
    sourceType: {
      type: String,
      enum: ["marketplace", "promoted", "featured", "future_coupon"],
      required: true,
      default: "marketplace",
    },
    category: {
      type: String,
      enum: ["electronics", "gaming", "sneakers", "fashion", "home", "auto", "other"],
      default: "other",
      index: true,
    },
    trustScore: { type: Number, min: 0, max: 100, default: 65, index: true },
    demandLevel: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    expiresAt: { type: Date, index: true },
    rewardPoints: { type: Number, default: 0, min: 0 },
    sellerId: { type: String, default: "", index: true },
    isPromoted: { type: Boolean, default: false, index: true },
    promotionTier: { type: String, enum: ["basic", "featured", "boosted"], default: "basic" },
  },
  {
    timestamps: true,
  }
);

offerSchema.index({ category: 1, sourceType: 1, isPromoted: -1 });
offerSchema.index({ trustScore: -1, rewardPoints: -1, expiresAt: 1 });

module.exports = mongoose.model("Offer", offerSchema);

