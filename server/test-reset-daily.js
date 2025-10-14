const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function testResetDaily() {
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

    console.log('\n🎯 Resetting Daily Tasks...');
    
    // Check current state
    console.log('Current points:', testUser.points);
    const beforeTasks = testUser.getDailyTasks();
    console.log('Before reset - Daily login completed:', beforeTasks.tasks.dailyLogin.completed);

    // Manually reset daily tasks by changing the day
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    testUser.dailyTasks.day = yesterday.toISOString().split('T')[0];
    await testUser.save();

    // Now get tasks again (should trigger reset)
    const afterTasks = testUser.getDailyTasks();
    console.log('After reset - Daily login completed:', afterTasks.tasks.dailyLogin.completed);

    // Test claiming daily login
    console.log('\n🏠 Testing daily login claim after reset...');
    const beforePoints = testUser.points;
    await testUser.completeDailyLogin();
    await testUser.save();
    const afterPoints = testUser.points;
    
    console.log(`Points before: ${beforePoints}, after: ${afterPoints}`);
    console.log(`Points earned: ${afterPoints - beforePoints}`);

    // Check final state
    const finalTasks = testUser.getDailyTasks();
    console.log('Final daily login status:', finalTasks.tasks.dailyLogin.completed);

    console.log('\n✅ Daily reset and claim test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testResetDaily();
