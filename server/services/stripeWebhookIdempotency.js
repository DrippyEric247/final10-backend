/**
 * Stripe webhook idempotency — process each Stripe event ID exactly once when successful.
 */
const StripeWebhookEvent = require('../models/StripeWebhookEvent');

/**
 * @template T
 * @param {string} stripeEventId
 * @param {string} eventType
 * @param {() => Promise<T>} handler
 * @returns {Promise<{ duplicate: boolean, result: T | null }>}
 */
async function withStripeEventIdempotency(stripeEventId, eventType, handler) {
  const id = String(stripeEventId || '').trim();
  if (!id) {
    throw new Error('Stripe event id is required for idempotent webhook processing');
  }

  const existing = await StripeWebhookEvent.findOne({ stripeEventId: id }).lean();
  if (existing?.status === 'completed') {
    return { duplicate: true, result: existing.result ?? null };
  }
  if (existing?.status === 'processing') {
    return { duplicate: true, result: null };
  }

  if (existing?.status === 'failed') {
    await StripeWebhookEvent.updateOne(
      { stripeEventId: id },
      { $set: { status: 'processing', error: null } }
    );
  } else {
    try {
      await StripeWebhookEvent.create({
        stripeEventId: id,
        type: eventType,
        status: 'processing',
      });
    } catch (e) {
      if (e?.code === 11000) {
        const raced = await StripeWebhookEvent.findOne({ stripeEventId: id }).lean();
        if (raced?.status === 'completed') {
          return { duplicate: true, result: raced.result ?? null };
        }
        return { duplicate: true, result: null };
      }
      throw e;
    }
  }

  try {
    const result = await handler();
    await StripeWebhookEvent.updateOne(
      { stripeEventId: id },
      { $set: { status: 'completed', result } }
    );
    return { duplicate: false, result };
  } catch (err) {
    await StripeWebhookEvent.updateOne(
      { stripeEventId: id },
      { $set: { status: 'failed', error: String(err?.message || err).slice(0, 500) } }
    );
    throw err;
  }
}

module.exports = { withStripeEventIdempotency };
