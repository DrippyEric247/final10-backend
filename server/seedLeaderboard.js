// server/seedLeaderboard.js
const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

const User = require('./models/User');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // wipe old leaderboard test users (optional)
    await User.deleteMany({ email: /leaderboard-test/ });

    // create 5 users with descending lifetime points
    const users = [
      { handle: 'SavvyKing', email: 'leaderboard-test1@final10.app', pointsBalance: 5000, lifetimePointsEarned: 150000, badges: [{ name: 'Gold', awardedAt: new Date() }] },
      { handle: 'AuctionQueen', email: 'leaderboard-test2@final10.app', pointsBalance: 4200, lifetimePointsEarned: 120000, badges: [{ name: 'Silver', awardedAt: new Date() }] },
      { handle: 'BidBoss', email: 'leaderboard-test3@final10.app', pointsBalance: 3900, lifetimePointsEarned: 90000 },
      { handle: 'SavvyStarter', email: 'leaderboard-test4@final10.app', pointsBalance: 2500, lifetimePointsEarned: 60000 },
      { handle: 'Final10Hero', email: 'leaderboard-test5@final10.app', pointsBalance: 1800, lifetimePointsEarned: 30000 },
    ];

    await User.insertMany(users);

    console.log('Inserted 5 leaderboard users ✅');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();

