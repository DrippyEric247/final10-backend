/**
 * Direct E2E run (no HTTP) — uses MONGODB_URI + eBay + Resend from .env
 * Usage: node scripts/run-alert-e2e-local.js ericvasquez012@gmail.com
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const { runRealAlertE2eVerify } = require('../services/alertE2eVerifyService');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/run-alert-e2e-local.js <email>');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  const result = await runRealAlertE2eVerify(user, { limit: 8 });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
