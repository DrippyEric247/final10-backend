#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const { buildMonthlyScoutReportData } = require('../services/monthlyScoutReportDataService');

const PLACEHOLDER_SAVVY = 2485;
const PLACEHOLDER_SAVINGS = 327;

async function runForUser(label, user) {
  if (!user) {
    console.log(`[skip] ${label}: no user found`);
    return;
  }
  const data = await buildMonthlyScoutReportData(user._id, { logMetrics: true });
  const hasPlaceholder =
    data.savvyEarned === PLACEHOLDER_SAVVY ||
    data.estimatedSavings === PLACEHOLDER_SAVINGS ||
    data.currentStreak === 34;
  console.log(`[${label}]`, JSON.stringify({
    userId: String(user._id),
    email: user.email,
    userName: data.userName,
    savvyEarned: data.savvyEarned,
    savvyBalance: data.savvyBalance,
    estimatedSavings: data.estimatedSavings,
    alertsCreated: data.alertsCreated,
    alertClicks: data.alertClicks,
    dealsSaved: data.dealsSaved,
    lightActivity: data.lightActivity,
    hasPlaceholder,
  }, null, 2));
  if (hasPlaceholder) process.exitCode = 1;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({ role: { $in: ['admin', 'superadmin'] } })
    .select('_id email username')
    .lean();
  const inactive = await User.findOne({ loginStreakDays: 0, 'monthlyActivity.alertsCreated': 0 })
    .sort({ createdAt: -1 })
    .select('_id email username')
    .lean();
  const recent = await User.findOne()
    .sort({ createdAt: -1 })
    .select('_id email username')
    .lean();

  await runForUser('admin', admin);
  await runForUser('recent', recent);
  await runForUser('low-activity', inactive);

  await mongoose.disconnect();
  console.log('[done] monthly scout report data smoke test');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
