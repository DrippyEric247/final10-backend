// Add some demo points to the demo user
const mongoose = require('mongoose');
const User = require('./models/User');
const Points = require('./models/PointsLedger');

async function addDemoPoints() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Find the demo user
    const demoUser = await User.findOne({ email: 'demo@final10.com' });
    if (!demoUser) {
      console.log('❌ Demo user not found');
      return;
    }

    console.log(`📊 Found demo user: ${demoUser.username} (${demoUser.email})`);

    // Add some points
    const pointsToAdd = 1500;
    demoUser.pointsBalance = (demoUser.pointsBalance || 0) + pointsToAdd;
    demoUser.lifetimePointsEarned = (demoUser.lifetimePointsEarned || 0) + pointsToAdd;
    
    await demoUser.save();

    // Add a ledger entry
    await Points.create({
      userId: demoUser._id,
      type: 'earn',
      amount: pointsToAdd,
      source: 'demo_bonus',
      refId: 'demo',
      idempotencyKey: `demo_bonus_${Date.now()}`
    });

    console.log(`✅ Added ${pointsToAdd} points to demo user`);
    console.log(`   New balance: ${demoUser.pointsBalance}`);
    console.log(`   Lifetime earned: ${demoUser.lifetimePointsEarned}`);

  } catch (error) {
    console.error('❌ Error adding demo points:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

addDemoPoints();

