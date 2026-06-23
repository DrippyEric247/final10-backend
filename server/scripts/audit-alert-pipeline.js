/**
 * Audit alert pipeline state in MongoDB.
 * Usage: node scripts/audit-alert-pipeline.js [email]
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Alert = require('../models/Alert');

async function main() {
  const emailFilter = process.argv[2] ? process.argv[2].toLowerCase().trim() : null;
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';
  await mongoose.connect(uri);

  const globalAlerts = await Alert.find({ isActive: true })
    .select('name keywords user minConfidence maxPrice sources triggerCount lastTriggeredAt matches updatedAt')
    .lean();

  let users = [];
  if (emailFilter) {
    const u = await User.findOne({ email: emailFilter })
      .select('email username alertEmailOnMatch notifications role')
      .lean();
    if (u) users = [u];
  } else {
    const userIds = [...new Set(globalAlerts.map((a) => String(a.user)))];
    users = await User.find({ _id: { $in: userIds } })
      .select('email username alertEmailOnMatch notifications role')
      .lean();
  }

  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const report = {
    env: {
      NODE_ENV: process.env.NODE_ENV || 'development',
      ALERT_EMAIL_ENABLED: process.env.ALERT_EMAIL_ENABLED || null,
      ALERT_EMAIL_DEFAULT: process.env.ALERT_EMAIL_DEFAULT || null,
      DISABLE_SAVVY_SCOUT_SCAN: process.env.DISABLE_SAVVY_SCOUT_SCAN || null,
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      emailProvider: process.env.RESEND_API_KEY ? 'resend' : process.env.SMTP_HOST ? 'smtp' : 'none',
    },
    activeAlertsCount: globalAlerts.length,
    alertsWithMatches: globalAlerts.filter((a) => (a.matches || []).length > 0).length,
    totalTriggers: globalAlerts.reduce((s, a) => s + (a.triggerCount || 0), 0),
    recentTriggers: globalAlerts
      .filter((a) => a.lastTriggeredAt)
      .sort((a, b) => new Date(b.lastTriggeredAt) - new Date(a.lastTriggeredAt))
      .slice(0, 10)
      .map((a) => ({
        alertId: String(a._id),
        name: a.name,
        userEmail: userMap.get(String(a.user))?.email || String(a.user),
        triggerCount: a.triggerCount,
        lastTriggeredAt: a.lastTriggeredAt,
        matchCount: (a.matches || []).length,
        keywords: a.keywords,
        minConfidence: a.minConfidence,
        maxPrice: a.maxPrice,
      })),
    users: users.map((u) => {
      const userAlerts = globalAlerts.filter((a) => String(a.user) === String(u._id));
      const alertMatches = userAlerts.filter((a) => (a.matches || []).length > 0);
      const inAppAlertNotifs = (u.notifications || []).filter((n) => n.kind === 'alert_match');
      return {
        userId: String(u._id),
        email: u.email,
        username: u.username,
        role: u.role,
        alertEmailOnMatch: u.alertEmailOnMatch,
        emailWouldSend:
          Boolean(u.alertEmailOnMatch) ||
          String(process.env.ALERT_EMAIL_DEFAULT || '').toLowerCase() === 'true',
        activeAlerts: userAlerts.length,
        alertsWithMatches: alertMatches.length,
        inAppAlertNotifications: inAppAlertNotifs.length,
        recentInAppAlertNotifs: inAppAlertNotifs.slice(0, 5).map((n) => ({
          title: n.title,
          createdAt: n.createdAt,
          listingId: n.listingId,
        })),
        alerts: userAlerts.map((a) => ({
          id: String(a._id),
          name: a.name,
          keywords: a.keywords,
          minConfidence: a.minConfidence,
          maxPrice: a.maxPrice,
          sources: a.sources,
          triggerCount: a.triggerCount,
          lastTriggeredAt: a.lastTriggeredAt,
          matchCount: (a.matches || []).length,
        })),
      };
    }),
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
