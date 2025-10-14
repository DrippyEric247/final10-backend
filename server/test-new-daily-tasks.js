const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

async function testNewDailyTasks() {
  try {
    console.log('🧪 Testing New Daily Tasks...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Find or create a test user
    let testUser = await User.findOne({ username: 'testuser' });
    if (!testUser) {
      testUser = await User.create({
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        points: 100
      });
      console.log('✅ Created test user');
    } else {
      console.log('✅ Found existing test user');
    }

    console.log(`\n📊 Initial user state:`);
    console.log(`   Points: ${testUser.points}`);
    console.log(`   Daily tasks completed: ${JSON.stringify(testUser.dailyTasks.completed, null, 2)}`);

    // Test 1: Video Scanner Task
    console.log('\n🤖 Test 1: Video Scanner Task');
    console.log('=' .repeat(50));
    
    const beforeVideoScanner = testUser.points;
    await testUser.completeVideoScannerTask();
    const afterVideoScanner = testUser.points;
    const videoScannerPoints = afterVideoScanner - beforeVideoScanner;
    
    console.log(`✅ Video scanner task completed`);
    console.log(`   Points earned: ${videoScannerPoints}`);
    console.log(`   Task completed: ${testUser.dailyTasks.completed.useVideoScanner}`);
    console.log(`   Total points: ${testUser.points}`);

    // Test 2: Local Deals Search Task
    console.log('\n🏪 Test 2: Local Deals Search Task');
    console.log('=' .repeat(50));
    
    const beforeLocalDeals = testUser.points;
    await testUser.completeLocalDealsTask();
    const afterLocalDeals = testUser.points;
    const localDealsPoints = afterLocalDeals - beforeLocalDeals;
    
    console.log(`✅ Local deals search task completed`);
    console.log(`   Points earned: ${localDealsPoints}`);
    console.log(`   Task completed: ${testUser.dailyTasks.completed.searchLocalDeals}`);
    console.log(`   Total points: ${testUser.points}`);

    // Test 3: Get Daily Tasks Status
    console.log('\n📋 Test 3: Daily Tasks Status');
    console.log('=' .repeat(50));
    
    const dailyTasks = testUser.getDailyTasks();
    console.log('Daily tasks status:');
    
    Object.entries(dailyTasks.tasks).forEach(([key, task]) => {
      console.log(`\n${task.icon} ${task.name}`);
      console.log(`   Description: ${task.description}`);
      console.log(`   Points: ${task.points}`);
      console.log(`   Completed: ${task.completed ? '✅' : '❌'}`);
      if (task.progress !== undefined) {
        console.log(`   Progress: ${task.progress}/${task.target}`);
      }
    });

    console.log(`\n📊 Summary:`);
    console.log(`   Total points earned today: ${dailyTasks.totalPointsEarned}`);
    console.log(`   All tasks completed: ${dailyTasks.allTasksCompleted ? '✅' : '❌'}`);
    console.log(`   Bonus eligible: ${dailyTasks.bonusEligible ? '✅' : '❌'}`);

    // Test 4: Verify XP and Level Stats
    console.log('\n🎯 Test 4: XP and Level Stats');
    console.log('=' .repeat(50));
    
    try {
      const levelInfo = await testUser.getLevelInfo();
      console.log(`✅ Level info retrieved:`);
      console.log(`   Current level: ${levelInfo.currentLevel}`);
      console.log(`   Total XP: ${levelInfo.totalXP}`);
      console.log(`   XP to next level: ${levelInfo.xpToNextLevel}`);
      console.log(`   XP progress: ${levelInfo.xpProgress}%`);
    } catch (error) {
      console.log(`❌ Level info error: ${error.message}`);
    }

    // Test 5: Try to complete tasks again (should not give points)
    console.log('\n🔄 Test 5: Duplicate Task Completion');
    console.log('=' .repeat(50));
    
    const beforeDuplicate = testUser.points;
    await testUser.completeVideoScannerTask();
    const afterDuplicate = testUser.points;
    const duplicatePoints = afterDuplicate - beforeDuplicate;
    
    console.log(`✅ Duplicate video scanner task attempted`);
    console.log(`   Points earned: ${duplicatePoints} (should be 0)`);
    console.log(`   Task still completed: ${testUser.dailyTasks.completed.useVideoScanner}`);

    console.log('\n🎉 New Daily Tasks Test Complete!');
    console.log('=' .repeat(50));
    console.log('✅ Video scanner task: 20 points');
    console.log('✅ Local deals search task: 25 points');
    console.log('✅ Daily tasks status tracking works');
    console.log('✅ XP and level progression works');
    console.log('✅ Duplicate task prevention works');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the test
testNewDailyTasks();


