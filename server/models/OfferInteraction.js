const mongoose = require("mongoose");

const offerInteractionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    offerId: { type: String, required: true, index: true },
    clickedAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verificationMethod: {
      type: String,
      enum: ["none", "manual", "qr", "code", "api"],
      default: "none",
    },
    rewardGiven: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["none", "clicked", "claimed", "verified", "blocked"],
      default: "none",
      index: true,
    },
    rapidSignals: { type: Number, default: 0, min: 0 },
    userAgent: { type: String, default: "" },
    ipHash: { type: String, default: "" },
  },
  { timestamps: true }
);

offerInteractionSchema.index({ userId: 1, offerId: 1 }, { unique: true });
offerInteractionSchema.index({ userId: 1, createdAt: -1 });
offerInteractionSchema.index({ userId: 1, claimedAt: -1 });

module.exports = mongoose.model("OfferInteraction", offerInteractionSchema);

