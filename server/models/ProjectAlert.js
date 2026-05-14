const mongoose = require('mongoose');

const trackedItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    keywords: [{ type: String, trim: true }],
    targetPrice: { type: Number },
    estimatedSavings: { type: Number, default: 0 },
    trustMin: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['watching', 'found', 'skipped'],
      default: 'watching',
    },
    notes: { type: String, default: '' },
    linkedAlertId: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', default: null },
  },
  { _id: true }
);

const projectAlertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'general', trim: true },
    budget: { type: Number },
    trustRequirement: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['watching', 'ready', 'completed'],
      default: 'watching',
      index: true,
    },
    items: [trackedItemSchema],
    bundleSavingsTarget: { type: Number },
    estimatedBundleSavings: { type: Number, default: 0 },
    aiSummary: { type: String, default: '' },
  },
  { timestamps: true }
);

projectAlertSchema.methods.recomputeStatus = function recomputeStatus() {
  if (!this.items || this.items.length === 0) {
    this.status = 'watching';
    return;
  }
  const done = (i) => i.status === 'found' || i.status === 'skipped';
  if (this.items.every(done)) this.status = 'ready';
  else this.status = 'watching';
};

module.exports = mongoose.model('ProjectAlert', projectAlertSchema);
