const mongoose = require('mongoose');
const User = require('./models/User');
const SavvyPoint = require('./models/SavvyPoint');

async function checkReferralSignup() {
  try {
    console.log('🔍 Checking referral signup for user "eric"...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to database');
    
    // Find the user "eric"
    const user = await User.findOne({ username: 'eric' });
    if (!user) {
      console.log('❌ User "eric" not found');
      return;
    }
    
    console.log('\n👤 User Details:');
    console.log(`- Username: ${user.username}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Referral Code Used: ${user.referralCodeUsed || 'None'}`);
    console.log(`- Current Points: ${user.points}`);
    console.log(`- Membership Tier: ${user.membershipTier}`);
    console.log(`- Created: ${user.createdAt}`);
    
    // Check if user has referral points
    const referralPoints = await SavvyPoint.find({ 
      userId: user._id, 
      type: 'signup_referral' 
    });
    
    console.log('\n💰 Referral Points:');
    if (referralPoints.length > 0) {
      referralPoints.forEach(point => {
        console.log(`- ${point.amount} points (${point.type}) - ${point.createdAt}`);
      });
    } else {
      console.log('- No referral points found');
    }
    
    // Check if "welcome" referral code exists
    const referrer = await User.findOne({ referralCode: 'welcome' });
    if (referrer) {
      console.log('\n🎯 Referrer Found:');
      console.log(`- Username: ${referrer.username}`);
      console.log(`- Email: ${referrer.email}`);
      console.log(`- Referral Code: ${referrer.referralCode}`);
      console.log(`- Points: ${referrer.points}`);
      
      // Check referrer's referral points
      const referrerPoints = await SavvyPoint.find({ 
        userId: referrer._id, 
        type: 'referral_bonus' 
      });
      
      console.log('\n🎁 Referrer Bonus Points:');
      if (referrerPoints.length > 0) {
        referrerPoints.forEach(point => {
          console.log(`- ${point.amount} points (${point.type}) - ${point.createdAt}`);
        });
      } else {
        console.log('- No referral bonus points found');
      }
    } else {
      console.log('\n❌ Referrer with code "welcome" not found');
    }
    
    // Check all users who used "welcome" referral code
    const usersWithWelcomeCode = await User.find({ referralCodeUsed: 'welcome' });
    console.log('\n👥 All users who used "welcome" referral code:');
    usersWithWelcomeCode.forEach(u => {
      console.log(`- ${u.username} (${u.email}) - ${u.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

checkReferralSignup();


