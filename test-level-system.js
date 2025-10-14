const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const UserLevel = require('./models/UserLevel');

async function testLevelSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Find or create a test user
    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      testUser = new User({
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        points: 0
      });
      await testUser.save();
      console.log('✅ Created test user');
    } else {
      console.log('✅ Found existing test user');
    }

    // Test level system
    console.log('\n🎯 Testing Level System...');
    
    // Get initial level info
    let levelInfo = await testUser.getLevelInfo();
    console.log(`Initial Level: ${levelInfo.currentLevel}, XP: ${levelInfo.totalXP}`);

    // Award XP for daily login
    console.log('\n📅 Awarding XP for daily login...');
    const loginResult = await testUser.awardXP(25, 'daily_login');
    console.log(`Result:`, loginResult);

    // Award XP for search task
    console.log('\n🔍 Awarding XP for search task...');
    const searchResult = await testUser.awardXP(15, 'search_task');
    console.log(`Result:`, searchResult);

    // Award XP for watching ads
    console.log('\n📺 Awarding XP for watching ads...');
    const adResult = await testUser.awardXP(10, 'ad_watch');
    console.log(`Result:`, adResult);

    // Award XP for sharing app
    console.log('\n📱 Awarding XP for sharing app...');
    const shareResult = await testUser.awardXP(20, 'app_share');
    console.log(`Result:`, shareResult);

    // Award XP for social media post
    console.log('\n📢 Awarding XP for social media post...');
    const socialResult = await testUser.awardXP(30, 'social_post');
    console.log(`Result:`, socialResult);

    // Get final level info
    levelInfo = await testUser.getLevelInfo();
    console.log(`\n🏆 Final Level: ${levelInfo.currentLevel}, XP: ${levelInfo.totalXP}`);
    console.log(`XP to next level: ${levelInfo.xpToNextLevel}`);
    console.log(`XP Progress: ${levelInfo.xpProgress}/${levelInfo.xpInfo.xpRange}`);

    // Test milestones
    console.log('\n🌟 Testing Milestones...');
    const milestones = await testUser.getLevelInfo();
    console.log(`Milestones achieved: ${milestones.milestones.length}`);

    // Test level leaderboard
    console.log('\n📊 Testing Level Leaderboard...');
    const leaderboard = await UserLevel.getLevelLeaderboard(10);
    console.log(`Leaderboard entries: ${leaderboard.length}`);

    console.log('\n✅ Level system test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testLevelSystem();
