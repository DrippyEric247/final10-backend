#!/usr/bin/env node
/**
 * Send early Savvy Scout Monthly Report test email (with Scout Goals section).
 *
 * Usage:
 *   node server/scripts/send-early-monthly-report.js
 *   node server/scripts/send-early-monthly-report.js ericvasquez012@gmail.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const mongoose = require('mongoose');
const { sendEarlyMonthlyReportTest, getEmailConfigStatus, logEmailStartup } = require('../services/emailService');
const { FOUNDER_ADMIN_EMAIL } = require('../lib/founderAdminAccess');

async function main() {
  const to = String(process.argv[2] || FOUNDER_ADMIN_EMAIL).trim().toLowerCase();
  logEmailStartup();
  const config = getEmailConfigStatus();
  console.log('[early-monthly-report] email config', JSON.stringify(config, null, 2));

  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[early-monthly-report] MongoDB connected');
  }

  const result = await sendEarlyMonthlyReportTest({ to });
  console.log('[early-monthly-report] result', JSON.stringify(result, null, 2));

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  if (!result.sent) {
    console.error('[early-monthly-report] FAILED — email not sent:', result.reason || 'unknown');
    process.exit(1);
  }

  console.log(`[early-monthly-report] Sent to ${to}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[early-monthly-report] error', err);
  process.exit(1);
});
