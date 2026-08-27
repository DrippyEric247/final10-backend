const mongoose = require('mongoose');

const DEAL_STATUSES = ['active', 'ended', 'sold', 'expired', 'removed', 'unavailable'];

const canonicalDealSnapshotSchema = new mongoose.Schema(
  {
    dealId: { type: String, required: true, unique: true, index: true },
    marketplace: { type: String, required: true, index: true },
    listingId: { type: String, required: true, index: true },
    status: { type: String, enum: DEAL_STATUSES, default: 'active', index: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    marketplaceUrl: { type: String, default: null },
    title: { type: String, default: null },
    imageUrl: { type: String, default: null },
    lastFetchedAt: { type: Date, default: null },
    lastSharedAt: { type: Date, default: null },
    shareCounts: {
      clicked: { type: Number, default: 0 },
      copied: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      marketplaceClicked: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

canonicalDealSnapshotSchema.index({ marketplace: 1, listingId: 1 }, { unique: true });

module.exports = mongoose.model('CanonicalDealSnapshot', canonicalDealSnapshotSchema);
module.exports.DEAL_STATUSES = DEAL_STATUSES;
