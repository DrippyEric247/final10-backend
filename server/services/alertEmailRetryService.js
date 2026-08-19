/**
 * Bounded, idempotent alert email retry worker (Wave 7).
 * Email retries NEVER re-grant Savvy — delivery only.
 */

const Alert = require('../models/Alert');
const User = require('../models/User');
const Auction = require('../models/Auction');
const { sendAlertMatchEmail } = require('./emailService');
const { auditAlertDelivery } = require('./auditLogger');
const { resolveSavvyBalance } = require('../lib/dataAuthority');
const { withJobLease, defaultOwnerId } = require('../lib/distributedJobLock');
const { info, warn } = require('./structuredLog');

const MAX_EMAIL_RETRIES = Number(process.env.ALERT_EMAIL_MAX_RETRIES || 5);
const BASE_BACKOFF_MS = Number(process.env.ALERT_EMAIL_RETRY_BASE_MS || 60000);
const BATCH_SIZE = Number(process.env.ALERT_EMAIL_RETRY_BATCH || 25);

const PERMANENT_FAILURE_REASONS = new Set([
  'invalid_recipient',
  'bounced',
  'blocked',
  'recipient_invalid',
  'domain_blocked',
]);

function computeNextAttemptAt(retryCount) {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, retryCount), 3600000);
  return new Date(Date.now() + delay);
}

function scheduleEmailRetry(match, reason) {
  const count = Math.round(Number(match.emailRetryCount) || 0);
  if (PERMANENT_FAILURE_REASONS.has(String(reason || '').toLowerCase())) {
    return {
      emailDeliveryStatus: 'failed',
      emailFailureReason: String(reason || 'permanent').slice(0, 120),
      emailNextAttemptAt: null,
    };
  }
  if (count >= MAX_EMAIL_RETRIES) {
    return {
      emailDeliveryStatus: 'failed',
      emailFailureReason: 'max_retries_exceeded',
      emailNextAttemptAt: null,
    };
  }
  return {
    emailDeliveryStatus: 'retry',
    emailRetryCount: count + 1,
    emailLastAttemptAt: new Date(),
    emailNextAttemptAt: computeNextAttemptAt(count + 1),
    emailFailureReason: String(reason || 'send_failed').slice(0, 120),
  };
}

async function markEmailRetryState(alertId, matchSubdocId, patch) {
  const idKey = matchSubdocId ? '_id' : 'auction';
  const matchValue = matchSubdocId;
  await Alert.updateOne(
    {
      _id: alertId,
      matches: {
        $elemMatch: matchSubdocId
          ? { _id: matchSubdocId, emailSentAt: null }
          : { emailSentAt: null },
      },
    },
    { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`matches.$.${k}`, v])) }
  );
}

async function sendEmailForMatch(user, alert, auction, matchSubdocId) {
  const imageUrl = auction.images?.[0]?.url || auction.image || auction.source?.image || '';
  const currentPrice = auction.currentBid ?? auction.currentPrice ?? auction.price;
  const listingUrl = auction.source?.url || '';

  return sendAlertMatchEmail({
    to: user.email,
    alertName: alert.name,
    listingTitle: auction.title,
    listingUrl,
    dealData: {
      userName: user.username || 'Savvy Hunter',
      productTitle: auction.title,
      productImage: imageUrl,
      currentPrice,
      originalPrice: auction.marketValue ?? auction.originalPrice,
      savingsAmount: auction.savings,
      savingsPercent: auction.savingsPct,
      trustScore: auction.trustScore ?? auction.sellerFeedbackPercent,
      rankedAbovePercent: auction.rankedAbovePercent,
      shippingStatus: auction.shippingStatus || 'See listing for shipping',
      savvyBalance: resolveSavvyBalance(user),
      userLevel: user.membershipTier || user.subscription?.tier || 'Explorer',
      baseReward: 5,
    },
  });
}

async function retrySingleMatchEmail(alertDoc, match) {
  if (match.emailSentAt) return { ok: true, skipped: true, reason: 'already_sent' };
  if (match.emailDeliveryStatus === 'failed') return { ok: false, skipped: true, reason: 'terminal_failed' };

  const user = await User.findById(alertDoc.user).select('username email alertEmailOnMatch membershipTier subscription savvyPoints');
  if (!user?.email) {
    await markEmailRetryState(alertDoc._id, match._id, scheduleEmailRetry(match, 'invalid_recipient'));
    return { ok: false, reason: 'no_email' };
  }

  const auction = await Auction.findById(match.auction).lean();
  if (!auction) {
    await markEmailRetryState(alertDoc._id, match._id, scheduleEmailRetry(match, 'auction_missing'));
    return { ok: false, reason: 'auction_missing' };
  }

  try {
    const emailResult = await sendEmailForMatch(user, alertDoc, auction, match._id);
    if (emailResult?.sent) {
      await Alert.updateOne(
        {
          _id: alertDoc._id,
          matches: { $elemMatch: { _id: match._id, emailSentAt: null } },
        },
        {
          $set: {
            'matches.$.emailSentAt': new Date(),
            'matches.$.emailDeliveryStatus': 'sent',
            'matches.$.emailNextAttemptAt': null,
            'matches.$.emailFailureReason': null,
          },
        }
      );
      auditAlertDelivery({
        userId: String(alertDoc.user),
        alertId: String(alertDoc._id),
        channel: 'email',
        phase: 'retry_success',
        sent: true,
      });
      return { ok: true, sent: true };
    }

    const patch = scheduleEmailRetry(match, emailResult?.reason || 'send_failed');
    await markEmailRetryState(alertDoc._id, match._id, patch);
    auditAlertDelivery({
      userId: String(alertDoc.user),
      alertId: String(alertDoc._id),
      channel: 'email',
      phase: 'retry_failure',
      sent: false,
      reason: emailResult?.reason || null,
    });
    return { ok: false, reason: emailResult?.reason || 'send_failed', retryScheduled: patch.emailDeliveryStatus === 'retry' };
  } catch (err) {
    const patch = scheduleEmailRetry(match, 'exception');
    await markEmailRetryState(alertDoc._id, match._id, patch);
    warn('ALERT_EMAIL_RETRY_ERROR', {
      alertId: String(alertDoc._id),
      matchId: String(match._id),
      message: String(err.message || '').slice(0, 120),
    });
    return { ok: false, reason: 'exception' };
  }
}

async function processAlertEmailRetryBatch() {
  const now = new Date();
  const alerts = await Alert.find({
    matches: {
      $elemMatch: {
        emailSentAt: null,
        emailDeliveryStatus: 'retry',
        emailNextAttemptAt: { $lte: now },
      },
    },
  })
    .limit(BATCH_SIZE)
    .lean(false);

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const alertDoc of alerts) {
    const dueMatches = (alertDoc.matches || []).filter(
      (m) =>
        !m.emailSentAt &&
        m.emailDeliveryStatus === 'retry' &&
        m.emailNextAttemptAt &&
        new Date(m.emailNextAttemptAt) <= now
    );
    for (const match of dueMatches) {
      processed += 1;
      const result = await retrySingleMatchEmail(alertDoc, match);
      if (result.sent) sent += 1;
      else if (!result.skipped) failed += 1;
    }
  }

  return { processed, sent, failed, alertsScanned: alerts.length };
}

async function runAlertEmailRetryWorker() {
  return withJobLease(
    'job:alert_email_retry',
    async () => processAlertEmailRetryBatch(),
    { ownerId: defaultOwnerId(), leaseMs: 120000 }
  );
}

module.exports = {
  MAX_EMAIL_RETRIES,
  computeNextAttemptAt,
  scheduleEmailRetry,
  processAlertEmailRetryBatch,
  runAlertEmailRetryWorker,
  retrySingleMatchEmail,
  PERMANENT_FAILURE_REASONS,
};
