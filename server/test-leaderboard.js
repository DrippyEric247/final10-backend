// Test the leaderboard query directly
const mongoose = require('mongoose');
const User = require('./models/User');

async function testLeaderboard() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Test the exact query from the leaderboard route
    const top = await User.find({}, { username: 1, lifetimePointsEarned: 1, badges: 1 })
      .sort({ lifetimePointsEarned: -1 })
      .limit(100)
      .lean();

    console.log('📊 Leaderboard query results:');
    console.log(`Found ${top.length} users`);
    
    top.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} - ${user.lifetimePointsEarned} points`);
    });

    // Also test finding the demo user specifically
    const demoUser = await User.findOne({ email: 'demo@final10.com' }, { username: 1, lifetimePointsEarned: 1, badges: 1 }).lean();
    console.log('\n📊 Demo user data:');
    console.log(demoUser);

  } catch (error) {
    console.error('❌ Error testing leaderboard:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

testLeaderboard();

