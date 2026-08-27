const mongoose = require('mongoose');

const DEAL_SHARE_EVENT_TYPES = [
  'deal_share_clicked',
  'deal_link_copied',
  'shared_deal_opened',
  'shared_deal_marketplace_clicked',
];

const dealShareEventSchema = new mongoose.Schema(
  {
    dealId: { type: String, required: true, index: true },
    marketplace: { type: String, default: 'ebay', index: true },
    listingId: { type: String, default: null, index: true },
    eventType: { type: String, enum: DEAL_SHARE_EVENT_TYPES, required: true, index: true },
    shareSource: { type: String, default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true }
);

dealShareEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DealShareEvent', dealShareEventSchema);
module.exports.DEAL_SHARE_EVENT_TYPES = DEAL_SHARE_EVENT_TYPES;
