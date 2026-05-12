const mongoose = require('mongoose');

/**
 * CreatorEvent — append-only ledger of creator-driven activity.
 *
 * One document per discrete event:
 *   - click   : someone hit a creator deep link (no auth required)
 *   - signup  : a new user signed up with this creator attributed
 *   - claim   : a Savvy / promo / reward claim attributed to this creator
 *   - savvy   : Savvy points earned by an attributed user (driven savvy)
 *
 * Designed so creator analytics is just a few cheap aggregations.
 */
const creatorEventSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    creatorHandle: {
      type: String,
      default: null,
      index: true,
    },
    creatorCode: {
      type: String,
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['click', 'signup', 'claim', 'savvy'],
      required: true,
      index: true,
    },
    /** Attributed user, when known (signup/claim/savvy). */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    /** Quantitative payload — savvy amount, claim value, etc. */
    amount: { type: Number, default: 0 },
    /** Free-form bucket — campaign tag, surface name, etc. */
    campaign: { type: String, default: null, index: true },
    source: { type: String, default: null },
    landingPath: { type: String, default: null },
    /** Lightweight de-dupe key for clicks (ip+ua hash on the route). */
    dedupeKey: { type: String, default: null, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

creatorEventSchema.index({ creatorId: 1, type: 1, createdAt: -1 });
creatorEventSchema.index({ creatorHandle: 1, type: 1, createdAt: -1 });

/**
 * Aggregate analytics for a single creator: clicks, signups, claims, savvy.
 */
creatorEventSchema.statics.summaryForCreator = async function (creatorIdOrHandle, sinceDate = null) {
  const match = {};
  if (creatorIdOrHandle && mongoose.Types.ObjectId.isValid(creatorIdOrHandle)) {
    match.creatorId = new mongoose.Types.ObjectId(String(creatorIdOrHandle));
  } else if (creatorIdOrHandle) {
    match.creatorHandle = String(creatorIdOrHandle);
  }
  if (sinceDate instanceof Date && !Number.isNaN(sinceDate.getTime())) {
    match.createdAt = { $gte: sinceDate };
  }

  const rows = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        amount: { $sum: '$amount' },
        users: { $addToSet: '$userId' },
      },
    },
  ]);

  const summary = {
    clicks: 0,
    signups: 0,
    claims: 0,
    savvyDriven: 0,
    uniqueUsers: 0,
  };
  const userSet = new Set();
  for (const row of rows) {
    if (row._id === 'click') summary.clicks = row.count;
    else if (row._id === 'signup') summary.signups = row.count;
    else if (row._id === 'claim') summary.claims = row.count;
    else if (row._id === 'savvy') summary.savvyDriven = row.amount || 0;
    if (Array.isArray(row.users)) {
      for (const u of row.users) {
        if (u) userSet.add(String(u));
      }
    }
  }
  summary.uniqueUsers = userSet.size;
  // Conversion rate: signups / clicks (guard against div-by-zero).
  summary.conversionRate =
    summary.clicks > 0 ? Number((summary.signups / summary.clicks).toFixed(4)) : 0;
  return summary;
};

module.exports = mongoose.model('CreatorEvent', creatorEventSchema);
