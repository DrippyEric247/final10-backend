require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({
    $or: [
      { email: /eric/i },
      { username: /eric/i },
      { betaTester: true },
      { foundingAccess: true },
    ],
  })
    .select(
      'email username betaTester foundingAccess betaAccessExpiresAt membershipTier subscription isPremium savvyPoints'
    )
    .lean();

  for (const u of users) {
    const hasFlag = Boolean(u.betaTester || u.foundingAccess);
    let active = false;
    if (hasFlag) {
      active = !u.betaAccessExpiresAt || new Date(u.betaAccessExpiresAt) > new Date();
    }
    console.log(
      JSON.stringify(
        {
          id: String(u._id),
          email: u.email,
          username: u.username,
          betaTester: Boolean(u.betaTester),
          foundingAccess: Boolean(u.foundingAccess),
          betaAccessExpiresAt: u.betaAccessExpiresAt || null,
          foundingTesterActive: active,
          membershipTier: u.membershipTier,
          subscriptionTier: u.subscription?.tier || null,
          isPremium: Boolean(u.isPremium),
        },
        null,
        2
      )
    );
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
