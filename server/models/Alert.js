const mongoose = require('mongoose');

const alertMatchSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
    matchedAt: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
  },
  { _id: true }
);

const alertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },                 // e.g. "iPhone 14 under $500"
    keywords: [{ type: String, trim: true }],               // ["iphone","14","pro"]
    maxPrice: { type: Number },                             // optional cap
    minConfidence: { type: Number, default: 70, min: 0, max: 100 },
    sources: [{ type: String, enum: ['ebay','mercari','facebook','craigslist','other'], default: 'ebay' }],
    persona: { type: String, enum: ["buyer", "seller"], default: "buyer", index: true },
    kind: { type: String, default: "custom", index: true },
    status: { type: String, enum: ["active", "triggered", "paused"], default: "active", index: true },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date },
    matches: [alertMatchSchema],
    triggerCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/**
 * @param {import('mongoose').Document & Record<string, unknown>} auction Saved Auction doc
 */
alertSchema.methods.matchesAuction = function matchesAuction(auction) {
  if (!this.isActive || !auction) return false;

  const platform = String(auction.source?.platform || '').toLowerCase();
  const sources = Array.isArray(this.sources) && this.sources.length
    ? this.sources.map((s) => String(s).toLowerCase())
    : ['ebay'];
  if (!sources.includes(platform)) return false;

  const title = String(auction.title || '').toLowerCase();
  const kws = (this.keywords || []).map((k) => String(k).trim().toLowerCase()).filter(Boolean);
  if (kws.length === 0) return false;
  if (!kws.every((k) => title.includes(k))) return false;

  const bid = Number(auction.currentBid);
  if (
    this.maxPrice != null &&
    Number.isFinite(Number(this.maxPrice)) &&
    Number.isFinite(bid) &&
    bid > Number(this.maxPrice)
  ) {
    return false;
  }

  const deal = Number(auction.aiScore?.dealPotential);
  const minC = Number(this.minConfidence);
  if (Number.isFinite(minC) && Number.isFinite(deal) && deal < minC) return false;

  return true;
};

module.exports = mongoose.model('Alert', alertSchema);










































