const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testAdSystem() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    // Create a test user
    let testUser = await User.findOne({ email: 'adtest@example.com' });
    if (!testUser) {
      testUser = new User({
        username: 'adtestuser',
        email: 'adtest@example.com',
        password: 'hashedpassword',
        membershipTier: 'free'
      });
      await testUser.save();
      console.log('Created test user');
    }

    console.log('\n🧪 Testing Ad-Watching System\n');

    // Test initial state
    console.log('📊 INITIAL STATE:');
    let searchStatus = testUser.canSearch();
    let adStatus = testUser.canWatchAd();
    console.log(`Searches: ${searchStatus.used}/${searchStatus.limit} (Base: ${searchStatus.baseLimit}, Ad-earned: ${searchStatus.adEarned})`);
    console.log(`Ads: ${adStatus.adsWatchedToday}/${adStatus.maxAdsPerDay} remaining`);

    // Use up all base searches
    console.log('\n🔍 USING UP BASE SEARCHES:');
    for (let i = 1; i <= 6; i++) {
      searchStatus = testUser.canSearch();
      if (searchStatus.canSearch) {
        await testUser.incrementSearchCount();
        console.log(`Search ${i}: ✅ Used (${searchStatus.used}/${searchStatus.limit})`);
      } else {
        console.log(`Search ${i}: ❌ Blocked - limit reached`);
        break;
      }
    }

    // Show ad option
    console.log('\n📺 AD WATCHING OPTIONS:');
    adStatus = testUser.canWatchAd();
    if (adStatus.canWatch) {
      console.log(`✅ Can watch ads: ${adStatus.remainingAds} remaining`);
      console.log(`💰 Each ad gives ${adStatus.searchesPerAd} searches`);
    } else {
      console.log('❌ Cannot watch more ads today');
    }

    // Watch ads to earn more searches
    console.log('\n📺 WATCHING ADS:');
    for (let i = 1; i <= 4; i++) {
      adStatus = testUser.canWatchAd();
      if (adStatus.canWatch) {
        await testUser.completeAdWatch();
        searchStatus = testUser.canSearch();
        console.log(`Ad ${i}: ✅ Watched! Earned ${testUser.adWatching.searchesPerAd} searches`);
        console.log(`  Total searches now: ${searchStatus.limit} (Base: ${searchStatus.baseLimit}, Ad-earned: ${searchStatus.adEarned})`);
      } else {
        console.log(`Ad ${i}: ❌ Cannot watch more ads today`);
        break;
      }
    }

    // Test searches with ad-earned searches
    console.log('\n🔍 USING AD-EARNED SEARCHES:');
    for (let i = 1; i <= 10; i++) {
      searchStatus = testUser.canSearch();
      if (searchStatus.canSearch) {
        await testUser.incrementSearchCount();
        console.log(`Search ${i}: ✅ Used (${searchStatus.used}/${searchStatus.limit})`);
      } else {
        console.log(`Search ${i}: ❌ Blocked - all searches used`);
        break;
      }
    }

    // Test premium user (no ads needed)
    console.log('\n💎 TESTING PREMIUM USER:');
    await testUser.upgradeToPremium(1);
    adStatus = testUser.canWatchAd();
    searchStatus = testUser.canSearch();
    console.log(`Premium user - Can watch ads: ${adStatus.canWatch} (${adStatus.reason})`);
    console.log(`Premium user - Searches: ${searchStatus.remaining} (unlimited)`);

    console.log('\n✅ Ad-watching system test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAdSystem();
