/**
 * Grant Founding Tester flags on a user by email.
 * Usage: node server/scripts/grant-founding-tester.js eric@ericfinal10app.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node server/scripts/grant-founding-tester.js <email>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  user.betaTester = true;
  user.foundingAccess = true;
  user.betaAccessExpiresAt = null;
  await user.save();

  const active = user.hasFoundingTesterAccess();
  console.log(
    JSON.stringify(
      {
        id: String(user._id),
        email: user.email,
        username: user.username,
        betaTester: Boolean(user.betaTester),
        foundingAccess: Boolean(user.foundingAccess),
        betaAccessExpiresAt: user.betaAccessExpiresAt,
        foundingTesterActive: active,
        membershipTier: user.membershipTier,
        subscriptionTier: user.subscription?.tier || null,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
