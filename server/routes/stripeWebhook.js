const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const {
  upsertFromStripeSubscription,
  markEntitlementStatus,
} = require('../services/premiumEntitlementService');
const { reconcileBattlePassPremiumFromEntitlement } = require('../services/battlePassPersistenceService');
const { logPaymentFailure } = require('../services/structuredLog');

function getStripeUserId(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const id = metadata.userId || metadata.user_id;
  return id ? String(id) : null;
}

async function handleSubscriptionRecord(subscription) {
  const userId = getStripeUserId(subscription.metadata);
  if (!userId) {
    logPaymentFailure('webhook', 'missing userId in subscription metadata', 'WEBHOOK_MISSING_USER');
    return;
  }
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  await upsertFromStripeSubscription(userId, subscription, customerId);
  await reconcileBattlePassPremiumFromEntitlement(userId);
}

/**
 * Stripe webhook — must run with `express.raw({ type: 'application/json' })` so signatures verify.
 */
async function stripeWebhookHandler(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logPaymentFailure('webhook', 'STRIPE_WEBHOOK_SECRET not configured', 'WEBHOOK_MISCONFIGURED');
    return res.status(503).json({ code: 'WEBHOOK_MISCONFIGURED', message: 'Webhook endpoint is not configured.' });
  }

  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    logPaymentFailure('webhook', err && err.message, 'WEBHOOK_SIGNATURE_INVALID');
    return res.status(400).json({ code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Invalid webhook signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          const userId = getStripeUserId(session.metadata) || getStripeUserId(sub.metadata);
          if (!userId) break;
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
          await upsertFromStripeSubscription(userId, sub, customerId);
          await reconcileBattlePassPremiumFromEntitlement(userId);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionRecord(event.data.object);
        break;
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId = getStripeUserId(sub.metadata);
        if (userId) {
          await markEntitlementStatus(userId, 'canceled', {
            providerSubscriptionId: sub.id,
            cancelAtPeriodEnd: false,
          });
          await reconcileBattlePassPremiumFromEntitlement(userId);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscriptionRecord(sub);
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = invoice.subscription;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const userId = getStripeUserId(sub.metadata);
          if (userId) {
            await markEntitlementStatus(userId, 'past_due', { providerSubscriptionId: sub.id });
            await reconcileBattlePassPremiumFromEntitlement(userId);
          }
        }
        break;
      }
      default:
        break;
    }
    return res.json({ received: true });
  } catch (err) {
    logPaymentFailure('webhook_process', err && err.message, 'WEBHOOK_HANDLER_ERROR');
    return res.status(500).json({ code: 'WEBHOOK_PROCESS_FAILED', message: 'Webhook processing failed' });
  }
}

module.exports = { stripeWebhookHandler };
