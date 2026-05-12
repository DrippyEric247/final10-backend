/**
 * Initialize battle pass + cosmetic documents for an existing user (by email).
 * Usage: node scripts/seed-progression-for-user.js user@example.com
 *
 * Requires MONGODB_URI and existing user record.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const { initProgressionForUser } = require('../services/battlePassPersistenceService');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node scripts/seed-progression-for-user.js <email>');
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';
  await mongoose.connect(uri);
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  const state = await initProgressionForUser(user._id, { reset: false });
  console.log('Progression initialized for', email);
  console.log(JSON.stringify({ battlePass: state.battlePass, cosmetics: state.cosmetics }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
