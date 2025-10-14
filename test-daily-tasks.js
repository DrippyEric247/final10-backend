const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');
const UserLevel = require('./server/models/UserLevel');

async function testDailyTasks() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Find or create a demo user
    let demoUser = await User.findOne({ email: 'demo@example.com' });
    if (!demoUser) {
      demoUser = new User({
        firstName: 'Demo',
        lastName: 'User',
        username: 'demouser',
        email: 'demo@example.com',
        password: 'hashedpassword',
        points: 0
      });
      await demoUser.save();
      console.log('✅ Created demo user');
    } else {
      console.log('✅ Found existing demo user');
    }

    console.log('\n🎯 Testing Daily Tasks System...');
    
    // Test 1: Get daily tasks status
    console.log('\n📋 Getting daily tasks status...');
    const dailyTasks = demoUser.getDailyTasks();
    console.log('Daily Tasks:', JSON.stringify(dailyTasks, null, 2));

    // Test 2: Complete daily login
    console.log('\n🏠 Testing daily login task...');
    const beforePoints = demoUser.points;
    await demoUser.completeDailyLogin();
    await demoUser.save();
    const afterPoints = demoUser.points;
    console.log(`Points before: ${beforePoints}, after: ${afterPoints}`);
    console.log(`Points earned: ${afterPoints - beforePoints}`);

    // Test 3: Complete search task
    console.log('\n🔍 Testing search task...');
    const beforeSearchPoints = demoUser.points;
    await demoUser.completeSearchTask();
    await demoUser.save();
    const afterSearchPoints = demoUser.points;
    console.log(`Points before: ${beforeSearchPoints}, after: ${afterSearchPoints}`);
    console.log(`Points earned: ${afterSearchPoints - beforeSearchPoints}`);

    // Test 4: Watch ads
    console.log('\n📺 Testing ad watching...');
    const beforeAdPoints = demoUser.points;
    await demoUser.trackAdForTask();
    await demoUser.save();
    const afterAdPoints = demoUser.points;
    console.log(`Points before: ${beforeAdPoints}, after: ${afterAdPoints}`);
    console.log(`Points earned: ${afterAdPoints - beforeAdPoints}`);

    // Test 5: Share app
    console.log('\n📱 Testing app sharing...');
    const beforeSharePoints = demoUser.points;
    await demoUser.trackAppShare();
    await demoUser.save();
    const afterSharePoints = demoUser.points;
    console.log(`Points before: ${beforeSharePoints}, after: ${afterSharePoints}`);
    console.log(`Points earned: ${afterSharePoints - beforeSharePoints}`);

    // Test 6: Share product
    console.log('\n🔗 Testing product sharing...');
    const beforeProductPoints = demoUser.points;
    await demoUser.trackProductShare();
    await demoUser.save();
    const afterProductPoints = demoUser.points;
    console.log(`Points before: ${beforeProductPoints}, after: ${afterProductPoints}`);
    console.log(`Points earned: ${afterProductPoints - beforeProductPoints}`);

    // Test 7: Social media post
    console.log('\n📢 Testing social media post...');
    const beforeSocialPoints = demoUser.points;
    await demoUser.completeSocialPost();
    await demoUser.save();
    const afterSocialPoints = demoUser.points;
    console.log(`Points before: ${beforeSocialPoints}, after: ${afterSocialPoints}`);
    console.log(`Points earned: ${afterSocialPoints - beforeSocialPoints}`);

    // Test 8: Get final daily tasks status
    console.log('\n📊 Final daily tasks status...');
    const finalTasks = demoUser.getDailyTasks();
    console.log('Final Tasks:', JSON.stringify(finalTasks, null, 2));

    // Test 9: Get level info
    console.log('\n🏆 Getting level information...');
    const levelInfo = await demoUser.getLevelInfo();
    console.log('Level Info:', JSON.stringify(levelInfo, null, 2));

    console.log('\n✅ Daily tasks test completed successfully!');
    console.log(`\n📈 Total points earned: ${demoUser.points}`);
    console.log(`🎯 Current level: ${levelInfo.currentLevel}`);
    console.log(`⭐ Total XP: ${levelInfo.totalXP}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testDailyTasks();

