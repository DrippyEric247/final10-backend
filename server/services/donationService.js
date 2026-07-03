/**
 * Donation / support payment rewards — idempotent via Stripe event IDs.
 */
const User = require('../models/User');
const { grantSystemCosmeticUnlock } = require('./cosmeticInventoryService');

/** Minimum paid amount (cents) to qualify as a support donation. */
const DONATION_MIN_CENTS = 100;

/** Cosmetics granted once per successful donation (any qualifying tier). */
const DONATION_SUPPORTER_COSMETICS = Object.freeze([
  'badge_founder_animated',
  'border_bp_s1',
  'card_founders_circle',
]);

/**
 * Resolve user from Stripe checkout session (metadata userId or customer email).
 */
async function resolveUserFromCheckoutSession(session) {
  const meta = session.metadata || {};
  const metaUserId = meta.userId || meta.user_id;
  if (metaUserId) {
    const byId = await User.findById(String(metaUserId));
    if (byId) return byId;
  }

  const email = session.customer_email || session.customer_details?.email;
  if (email) {
    const byEmail = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (byEmail) return byEmail;
  }

  return null;
}

function isDonationCheckoutSession(session) {
  if (!session || session.mode !== 'payment') return false;
  if (session.subscription) return false;

  const meta = session.metadata || {};
  if (meta.kind === 'donation' || meta.type === 'donation') return true;

  const amount = Number(session.amount_total) || 0;
  if (amount < DONATION_MIN_CENTS) return false;

  // Payment Links without metadata — treat one-time payments as donations when not subscription.
  return true;
}

/**
 * Grant supporter cosmetics idempotently per Stripe checkout session.
 * Uses session.id as stable idempotency anchor (stored in StripeWebhookEvent).
 */
async function processDonationCheckoutSession(session, stripeEventId) {
  if (!isDonationCheckoutSession(session)) {
    return { ok: false, skipped: true, reason: 'not_donation' };
  }

  const user = await resolveUserFromCheckoutSession(session);
  if (!user) {
    return {
      ok: false,
      skipped: true,
      reason: 'user_not_found',
      customerEmail: session.customer_email || null,
      sessionId: session.id,
    };
  }

  const granted = [];
  const idempotencyPrefix = `donation:${stripeEventId}:${session.id}`;

  for (const itemId of DONATION_SUPPORTER_COSMETICS) {
    const key = `${idempotencyPrefix}:${itemId}`;
    const wasNew = await grantSystemCosmeticUnlock(user._id, itemId, key);
    if (wasNew) granted.push(itemId);
  }

  if (!Array.isArray(user.badges)) user.badges = [];
  if (!user.badges.includes('beta_supporter')) {
    user.badges.push('beta_supporter');
    await user.save();
    granted.push('badge:beta_supporter');
  }

  return {
    ok: true,
    userId: String(user._id),
    sessionId: session.id,
    amountTotal: session.amount_total,
    currency: session.currency,
    cosmeticsGranted: granted,
    stripeEventId,
  };
}

module.exports = {
  DONATION_MIN_CENTS,
  DONATION_SUPPORTER_COSMETICS,
  resolveUserFromCheckoutSession,
  isDonationCheckoutSession,
  processDonationCheckoutSession,
};
