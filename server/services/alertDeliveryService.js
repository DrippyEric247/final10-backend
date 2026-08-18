const User = require('../models/User');
const Alert = require('../models/Alert');
const { sendAlertMatchEmail } = require('./emailService');
const { auditAlertDelivery } = require('./auditLogger');
const { isProduction } = require('../config/envValidation');
const { grantSavvyReward } = require('./savvyRewardService');

function isAlertEmailDefaultEnabled() {
  const raw = process.env.ALERT_EMAIL_DEFAULT;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).toLowerCase() === 'true';
  }
  return isProduction();
}

function deliveryKey(alertId, auctionId) {
  return `alert_match:${String(alertId)}:${String(auctionId)}`;
}

function savvyIdempotencyKey(alertId, auctionId) {
  return `alert_trigger:${String(alertId)}:${String(auctionId)}`;
}

/**
 * Deliver an alert match with independent idempotency for in-app, email, and Savvy.
 */
async function deliverAlertMatch(userId, auction, alert, matchSubdocId = null) {
  const user = await User.findById(userId).select(
    'username email notifications alertEmailOnMatch savvyPoints pointsBalance membershipTier subscription perkMachine'
  );
  if (!user) {
    auditAlertDelivery({ userId: String(userId), delivered: false, reason: 'user_not_found' });
    return { delivered: false, reason: 'user_not_found' };
  }

  const alertDoc = await Alert.findById(alert._id);
  if (!alertDoc) {
    return { delivered: false, reason: 'alert_not_found' };
  }

  const matchEntry = (alertDoc.matches || []).find(
    (m) =>
      String(m.auction) === String(auction._id) &&
      (!matchSubdocId || String(m._id) === String(matchSubdocId))
  );
  if (!matchEntry) {
    return { delivered: false, reason: 'match_not_found' };
  }

  const dKey = matchEntry.deliveryKey || deliveryKey(alert._id, auction._id);
  const title = `🎯 Savvy Scout: ${alert.name}`;
  const body = String(auction.title || '').slice(0, 280);
  const listingUrl = auction.source?.url || '';

  const matchFilter = matchSubdocId
    ? { _id: alert._id, matches: { $elemMatch: { _id: matchSubdocId } } }
    : { _id: alert._id, 'matches.auction': auction._id };

  let inAppDelivered = Boolean(matchEntry.inAppSentAt);

  if (!matchEntry.inAppSentAt) {
    const inAppClaim = await Alert.updateOne(
      {
        ...matchFilter,
        matches: {
          $elemMatch: matchSubdocId
            ? { _id: matchSubdocId, inAppSentAt: null }
            : { auction: auction._id, inAppSentAt: null },
        },
      },
      {
        $set: {
          'matches.$.inAppSentAt': new Date(),
          'matches.$.deliveryKey': dKey,
        },
      }
    );
    if (inAppClaim.modifiedCount > 0) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          notifications: {
            $each: [
              {
                kind: 'alert_match',
                title,
                body,
                listingId: String(auction._id),
                offerId: String(alert._id),
                createdAt: new Date(),
                readAt: null,
              },
            ],
            $position: 0,
            $slice: 100,
          },
        },
      });
      inAppDelivered = true;
    }
  }

  const emailWanted = Boolean(user.alertEmailOnMatch) || isAlertEmailDefaultEnabled();
  let emailSent = Boolean(matchEntry.emailSentAt);

  if (emailWanted && user.email && !matchEntry.emailSentAt) {
    auditAlertDelivery({
      userId: String(userId),
      alertId: String(alert._id),
      channel: 'email',
      phase: 'attempt',
      alertName: alert.name,
    });
    try {
      const imageUrl =
        auction.images?.[0]?.url || auction.image || auction.source?.image || '';
      const currentPrice = auction.currentBid ?? auction.currentPrice ?? auction.price;
      const emailResult = await sendAlertMatchEmail({
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
          savvyBalance: user.savvyPoints ?? user.pointsBalance ?? 0,
          userLevel: user.membershipTier || user.subscription?.tier || 'Explorer',
          baseReward: 5,
        },
      });
      if (emailResult?.sent) {
        await Alert.updateOne(
          {
            ...matchFilter,
            matches: {
              $elemMatch: matchSubdocId
                ? { _id: matchSubdocId, emailSentAt: null }
                : { auction: auction._id, emailSentAt: null },
            },
          },
          { $set: { 'matches.$.emailSentAt': new Date() } }
        );
        emailSent = true;
      }
      auditAlertDelivery({
        userId: String(userId),
        alertId: String(alert._id),
        channel: 'email',
        phase: emailResult?.sent ? 'success' : 'failure',
        sent: Boolean(emailResult?.sent),
        reason: emailResult?.reason || null,
        provider: emailResult?.provider || null,
        messageId: emailResult?.messageId || null,
      });
    } catch (err) {
      auditAlertDelivery({
        userId: String(userId),
        alertId: String(alert._id),
        channel: 'email',
        sent: false,
        reason: 'exception',
        message: String(err.message || '').slice(0, 120),
      });
    }
  }

  let savvyGranted = Boolean(matchEntry.savvyGrantedAt);
  if (!matchEntry.savvyGrantedAt) {
    try {
      const alertUser = await User.findById(userId);
      if (alertUser) {
        const result = await grantSavvyReward(alertUser, {
          rewardType: 'alert_trigger',
          amount: 5,
          baseAmount: 5,
          idempotencyKey: savvyIdempotencyKey(alert._id, auction._id),
          note: `Alert "${alert.name}" found a match!`,
          meta: { relatedId: String(auction._id), relatedType: 'Auction', alertId: String(alert._id) },
        });
        if (result?.granted !== false) {
          const savvyMark = await Alert.updateOne(
            {
              ...matchFilter,
              matches: {
                $elemMatch: matchSubdocId
                  ? { _id: matchSubdocId, savvyGrantedAt: null }
                  : { auction: auction._id, savvyGrantedAt: null },
              },
            },
            { $set: { 'matches.$.savvyGrantedAt': new Date() } }
          );
          if (savvyMark.modifiedCount > 0) {
            savvyGranted = true;
          }
        }
      }
    } catch (err) {
      console.warn('[alertDelivery] savvy award failed:', err.message);
    }
  }

  auditAlertDelivery({
    userId: String(userId),
    alertId: String(alert._id),
    listingId: String(auction._id),
    channel: 'in_app',
    delivered: inAppDelivered,
    emailSent,
    savvyGranted,
  });

  return { delivered: inAppDelivered, emailSent, savvyGranted };
}

/** Retry email for an existing match without re-granting Savvy. */
async function retryAlertMatchEmail(userId, alertId, auctionId) {
  const alert = await Alert.findOne({ _id: alertId, user: userId });
  if (!alert) return { ok: false, reason: 'alert_not_found' };
  const match = (alert.matches || []).find((m) => String(m.auction) === String(auctionId));
  if (!match) return { ok: false, reason: 'match_not_found' };
  const auction = await require('../models/Auction').findById(auctionId).lean();
  if (!auction) return { ok: false, reason: 'auction_not_found' };

  await Alert.updateOne(
    { _id: alertId, 'matches.auction': auctionId },
    { $unset: { 'matches.$.emailSentAt': 1 } }
  );
  const refreshed = await Alert.findById(alertId);
  const matchEntry = refreshed.matches.find((m) => String(m.auction) === String(auctionId));
  return deliverAlertMatch(userId, auction, refreshed, matchEntry._id);
}

module.exports = {
  deliverAlertMatch,
  retryAlertMatchEmail,
  isAlertEmailDefaultEnabled,
  deliveryKey,
  savvyIdempotencyKey,
};
