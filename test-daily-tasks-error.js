const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function testDailyTasksError() {
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

    console.log('\n🎯 Testing getDailyTasks method...');
    
    try {
      // Test the getDailyTasks method directly
      const dailyTasks = testUser.getDailyTasks();
      console.log('✅ getDailyTasks method works:', JSON.stringify(dailyTasks, null, 2));
    } catch (error) {
      console.log('❌ getDailyTasks method failed:', error.message);
      console.log('Stack trace:', error.stack);
    }

    console.log('\n🎯 Testing awardXP method...');
    
    try {
      // Test the awardXP method directly
      const xpResult = await testUser.awardXP(10, 'test');
      console.log('✅ awardXP method works:', xpResult);
    } catch (error) {
      console.log('❌ awardXP method failed:', error.message);
      console.log('Stack trace:', error.stack);
    }

    console.log('\n🎯 Testing updateLevelStats method...');
    
    try {
      // Test the updateLevelStats method directly
      const statsResult = await testUser.updateLevelStats('totalDaysActive', 1);
      console.log('✅ updateLevelStats method works:', statsResult);
    } catch (error) {
      console.log('❌ updateLevelStats method failed:', error.message);
      console.log('Stack trace:', error.stack);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testDailyTasksError();
