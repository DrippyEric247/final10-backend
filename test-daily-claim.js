const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');

async function testDailyClaim() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Find or create a test user
    let testUser = await User.findOne({ email: 'demo@example.com' });
    if (!testUser) {
      testUser = new User({
        firstName: 'Demo',
        lastName: 'User',
        username: 'demouser',
        email: 'demo@example.com',
        password: 'hashedpassword',
        points: 0
      });
      await testUser.save();
      console.log('✅ Created demo user');
    } else {
      console.log('✅ Found existing demo user');
    }

    console.log('\n🎯 Testing Daily Login Claim...');
    
    // Check initial state
    console.log('Initial points:', testUser.points);
    const initialTasks = testUser.getDailyTasks();
    console.log('Initial daily login status:', initialTasks.tasks.dailyLogin.completed);

    // Test daily login claim
    console.log('\n🏠 Claiming daily login...');
    const beforePoints = testUser.points;
    await testUser.completeDailyLogin();
    await testUser.save();
    const afterPoints = testUser.points;
    
    console.log(`Points before: ${beforePoints}, after: ${afterPoints}`);
    console.log(`Points earned: ${afterPoints - beforePoints}`);

    // Check final state
    const finalTasks = testUser.getDailyTasks();
    console.log('Final daily login status:', finalTasks.tasks.dailyLogin.completed);

    // Test if it can be claimed again (should not work)
    console.log('\n🔄 Trying to claim again...');
    const beforePoints2 = testUser.points;
    await testUser.completeDailyLogin();
    await testUser.save();
    const afterPoints2 = testUser.points;
    
    console.log(`Points before: ${beforePoints2}, after: ${afterPoints2}`);
    console.log(`Points earned: ${afterPoints2 - beforePoints2}`);

    console.log('\n✅ Daily claim test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testDailyClaim();

