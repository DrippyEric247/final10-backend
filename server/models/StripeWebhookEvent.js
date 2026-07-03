const mongoose = require('mongoose');

const stripeWebhookEventSchema = new mongoose.Schema(
  {
    /** Stripe event id (evt_...) — unique idempotency key for webhook processing. */
    stripeEventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StripeWebhookEvent', stripeWebhookEventSchema);
