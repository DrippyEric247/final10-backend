const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testRateLimit() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    // Create a test user
    let testUser = await User.findOne({ email: 'test@example.com' });
    if (!testUser) {
      testUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword',
        membershipTier: 'free'
      });
      await testUser.save();
      console.log('Created test user');
    }

    console.log('\n🧪 Testing Rate Limiting System\n');

    // Test free user limits
    console.log('📊 FREE USER TEST:');
    for (let i = 1; i <= 7; i++) {
      const searchStatus = testUser.canSearch();
      console.log(`Search ${i}: Can search: ${searchStatus.canSearch}, Remaining: ${searchStatus.remaining}`);
      
      if (searchStatus.canSearch) {
        await testUser.incrementSearchCount();
        console.log(`  ✅ Search performed`);
      } else {
        console.log(`  ❌ Search blocked - limit reached`);
        break;
      }
    }

    // Upgrade to premium
    console.log('\n💎 UPGRADING TO PREMIUM:');
    await testUser.upgradeToPremium(1);
    console.log('✅ User upgraded to Premium!');

    // Test premium user (unlimited)
    console.log('\n📊 PREMIUM USER TEST:');
    for (let i = 1; i <= 3; i++) {
      const searchStatus = testUser.canSearch();
      console.log(`Search ${i}: Can search: ${searchStatus.canSearch}, Remaining: ${searchStatus.remaining}`);
      
      if (searchStatus.canSearch) {
        await testUser.incrementSearchCount();
        console.log(`  ✅ Search performed (unlimited for premium)`);
      }
    }

    console.log('\n✅ Rate limiting test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testRateLimit();
