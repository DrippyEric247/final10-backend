const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },                 // e.g. "iPhone 14 under $500"
    keywords: [{ type: String, trim: true }],               // ["iphone","14","pro"]
    maxPrice: { type: Number },                             // optional cap
    minConfidence: { type: Number, default: 70, min: 0, max: 100 },
    sources: [{ type: String, enum: ['ebay','mercari','facebook','craigslist','other'], default: 'ebay' }],
    isActive: { type: Boolean, default: true },
    lastTriggeredAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);










































