const User = require('../models/User');
const SavvyPoint = require('../models/SavvyPoint');
const { sendAlertMatchEmail } = require('./emailService');
const { auditAlertDelivery } = require('./auditLogger');

/**
 * Deliver an alert match: in-app notification, optional email, Savvy points.
 */
async function deliverAlertMatch(userId, auction, alert) {
  const user = await User.findById(userId).select('username email notifications alertEmailOnMatch');
  if (!user) {
    auditAlertDelivery({ userId: String(userId), delivered: false, reason: 'user_not_found' });
    return { delivered: false, reason: 'user_not_found' };
  }

  const title = `🎯 Savvy Scout: ${alert.name}`;
  const body = String(auction.title || '').slice(0, 280);
  const listingUrl = auction.source?.url || '';

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

  const emailWanted =
    Boolean(user.alertEmailOnMatch) ||
    String(process.env.ALERT_EMAIL_DEFAULT || '').toLowerCase() === 'true';

  if (emailWanted && user.email) {
    try {
      const emailResult = await sendAlertMatchEmail({
        to: user.email,
        alertName: alert.name,
        listingTitle: auction.title,
        listingUrl,
      });
      auditAlertDelivery({
        userId: String(userId),
        alertId: String(alert._id),
        channel: 'email',
        sent: Boolean(emailResult?.sent),
        reason: emailResult?.reason || null,
        provider: emailResult?.provider || null,
      });
    } catch (err) {
      console.warn('[alertDelivery] email failed:', err.message);
      auditAlertDelivery({
        userId: String(userId),
        alertId: String(alert._id),
        channel: 'email',
        sent: false,
        reason: 'exception',
        message: String(err.message || '').slice(0, 120),
      });
    }
  } else {
    auditAlertDelivery({
      userId: String(userId),
      alertId: String(alert._id),
      channel: 'email',
      sent: false,
      reason: emailWanted ? 'no_email_on_file' : 'email_not_wanted',
    });
  }

  try {
    await SavvyPoint.awardPoints(
      userId,
      5,
      'alert_trigger',
      `Alert "${alert.name}" found a match!`,
      auction._id,
      'Auction',
      1
    );
  } catch (err) {
    console.warn('[alertDelivery] points award failed:', err.message);
  }

  console.log(
    `Alert matched and delivered. user=${user.username} alert="${alert.name}" listing="${String(auction.title || '').slice(0, 80)}"`
  );

  auditAlertDelivery({
    userId: String(userId),
    alertId: String(alert._id),
    listingId: String(auction._id),
    channel: 'in_app',
    delivered: true,
  });

  return { delivered: true };
}

module.exports = { deliverAlertMatch };
