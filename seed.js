// server/seed.js
const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' }); // adjust path if .env is above /server

const User = require('./models/User');
const PointsLedger = require('./models/PointsLedger');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to Mongo');

    // wipe any previous test user (optional)
    await User.deleteOne({ email: 'testuser@final10.app' });

    // create new test user
    const user = await User.create({
      handle: 'testuser',
      email: 'testuser@final10.app',
      pointsBalance: 50000,
      lifetimePointsEarned: 120000,
      badges: [{ name: 'Bronze', awardedAt: new Date() }],
      trial: {
        isActive: false,
        startedAt: new Date(),
        endsAt: new Date(),
        bonusMultiplier: 0.5,
        everGranted: true,
      },
    });

    console.log('Seeded user:', user._id);

    // add 2 ledger rows
    await PointsLedger.create([
      {
        userId: user._id,
        type: 'earn',
        amount: 10000,
        source: 'signup_bonus',
        idempotencyKey: 'seed-1',
      },
      {
        userId: user._id,
        type: 'redeem',
        amount: 5000,
        source: 'auction_demo',
        idempotencyKey: 'seed-2',
      },
    ]);

    console.log('Ledger seeded');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();

