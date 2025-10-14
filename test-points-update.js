const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');

async function testPointsUpdate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Find the demo user
    let testUser = await User.findOne({ email: 'demo@example.com' });
    if (!testUser) {
      console.log('❌ Demo user not found');
      return;
    }

    console.log('\n🎯 Testing Points Update...');
    
    // Check current state
    console.log('Current points:', testUser.points);
    const beforeTasks = testUser.getDailyTasks();
    console.log('Before - Daily login completed:', beforeTasks.tasks.dailyLogin.completed);

    // Reset daily tasks to test claiming
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    testUser.dailyTasks.day = yesterday.toISOString().split('T')[0];
    await testUser.save();

    // Get tasks after reset
    const afterResetTasks = testUser.getDailyTasks();
    console.log('After reset - Daily login completed:', afterResetTasks.tasks.dailyLogin.completed);

    // Test claiming daily login
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

    // Test the API response format
    console.log('\n📊 API Response Format:');
    const apiResponse = {
      userTier: testUser.membershipTier,
      totalPoints: testUser.points,
      dailyTasks: finalTasks,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    console.log(JSON.stringify(apiResponse, null, 2));

    console.log('\n✅ Points update test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testPointsUpdate();

