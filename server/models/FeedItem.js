const mongoose = require('mongoose');

const FeedItemSchema = new mongoose.Schema({
  source: { type: String, enum: ['youtube','reddit','tiktok','instagram','app'], required: true },
  sourceId: { type: String, index: true }, // e.g., YouTube videoId, Reddit post id
  author: {
    name: String,
    handle: String,
    avatar: String
  },
  text: String,
  permalink: String,
  media: [{
    type: { type: String, enum: ['video','image'] },
    url: String,        // direct media URL if allowed (YT = video iframe via id)
    embedHtml: String   // for TikTok/Instagram embeds (oEmbed HTML)
  }],
  tags: [String],       // e.g., #Final10, #StayEarning, #StaySavvy
  products: [{ name: String, link: String, confidence: Number }], // normalized product detection
  metrics: { likes: Number, views: Number, comments: Number },
  timestamp: { type: Date, index: true },
  rank: { type: Number, default: 0 }, // recency/engagement rank
  isProduct: { type: Boolean, index: true, default: false }
}, { timestamps: true });

FeedItemSchema.index({ source: 1, sourceId: 1 }, { unique: true });

module.exports = mongoose.model('FeedItem', FeedItemSchema);
