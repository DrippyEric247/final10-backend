const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testInviteSystem() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    // Create a test user (referrer)
    let referrer = await User.findOne({ email: 'referrer@example.com' });
    if (!referrer) {
      referrer = new User({
        username: 'referrer_user',
        email: 'referrer@example.com',
        password: 'hashedpassword',
        membershipTier: 'free',
        points: 0
      });
      await referrer.save();
      console.log('Created referrer user');
    }

    console.log('\n🎯 Testing Invite & Earn System\n');

    // Test referral link generation
    console.log('🔗 REFERRAL LINK GENERATION:');
    const referralLink = await referrer.generateReferralLink();
    const referralStats = await referrer.getReferralStats();
    console.log(`Referral Code: ${referralStats.referralCode}`);
    console.log(`Referral Link: ${referralLink}`);
    console.log(`Total Referrals: ${referralStats.totalReferrals}`);

    // Create a new user (referred)
    console.log('\n👤 CREATING REFERRED USER:');
    let newUser = await User.findOne({ email: 'referred@example.com' });
    if (!newUser) {
      newUser = new User({
        username: 'referred_user',
        email: 'referred@example.com',
        password: 'hashedpassword',
        membershipTier: 'free',
        points: 0
      });
      await newUser.save();
      console.log('Created referred user');
    } else {
      console.log('Using existing referred user');
    }

    // Process referral signup
    console.log('\n🤝 PROCESSING REFERRAL SIGNUP:');
    const result = await User.processReferralSignup(newUser._id, referrer.referralCode);
    console.log(`✅ Referral processed successfully!`);
    console.log(`Referrer: ${result.referrer} (+${result.referrerPoints} points)`);
    console.log(`New User: ${result.newUser} (+${result.newUserPoints} points)`);

    // Check updated stats
    console.log('\n📊 UPDATED REFERRAL STATS:');
    await referrer.save(); // Refresh referrer data
    const updatedStats = await referrer.getReferralStats();
    console.log(`Referrer Points: ${referrer.points}`);
    console.log(`Daily Referrals: ${updatedStats.dailyReferrals}`);
    console.log(`Total Referrals: ${updatedStats.totalReferrals}`);

    // Check new user stats
    const newUserUpdated = await User.findById(newUser._id);
    console.log(`New User Points: ${newUserUpdated.points}`);
    console.log(`Referred By: ${newUserUpdated.referredBy}`);

    // Test multiple referrals
    console.log('\n👥 TESTING MULTIPLE REFERRALS:');
    for (let i = 1; i <= 3; i++) {
      let anotherUser = await User.findOne({ email: `friend${i}@example.com` });
      if (!anotherUser) {
        anotherUser = new User({
          username: `friend_${i}`,
          email: `friend${i}@example.com`,
          password: 'hashedpassword',
          membershipTier: 'free',
          points: 0
        });
        await anotherUser.save();
      }
      
      await User.processReferralSignup(anotherUser._id, referrer.referralCode);
      console.log(`✅ Referred friend_${i} (+100 points)`);
    }

    // Final stats
    console.log('\n🎉 FINAL REFERRAL STATS:');
    await referrer.save();
    const finalStats = await referrer.getReferralStats();
    console.log(`Total Referrals: ${finalStats.totalReferrals}`);
    console.log(`Total Points Earned: ${referrer.points}`);
    console.log(`Referral Link: ${finalStats.referralLink}`);

    // Test referral leaderboard
    console.log('\n🏆 REFERRAL LEADERBOARD:');
    const leaderboard = await User.aggregate([
      { $match: { referralCountToday: { $gt: 0 } } },
      {
        $group: {
          _id: '$_id',
          username: { $first: '$username' },
          totalReferrals: { $sum: '$referralCountToday' },
          points: { $first: '$points' }
        }
      },
      { $sort: { totalReferrals: -1 } },
      { $limit: 5 }
    ]);

    console.log('Top Referrers:');
    leaderboard.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}: ${user.totalReferrals} referrals, ${user.points} points`);
    });

    console.log('\n✅ Invite & Earn system test completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testInviteSystem();
