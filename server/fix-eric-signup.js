const mongoose = require('mongoose');
const User = require('./models/User');

async function fixEricSignup() {
  try {
    console.log('🔧 Fixing Eric\'s signup...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to database');
    
    // Find Eric's user
    const eric = await User.findOne({ username: 'DrippyEric247' });
    if (!eric) {
      console.log('❌ Eric not found');
      return;
    }
    
    console.log('\n👤 Eric\'s current status:');
    console.log(`- Username: ${eric.username}`);
    console.log(`- Email: ${eric.email}`);
    console.log(`- Points: ${eric.points}`);
    console.log(`- Membership Tier: ${eric.membershipTier}`);
    console.log(`- Referral Code Used: ${eric.referralCodeUsed || 'None'}`);
    console.log(`- Created: ${eric.createdAt}`);
    
    // Check if Eric should have gotten the welcome bonus
    if (!eric.referralCodeUsed) {
      console.log('\n🎁 Eric didn\'t use a referral code, but let\'s give him the welcome bonus anyway...');
      
      // Give Eric the welcome bonus
      eric.points = 500; // Welcome bonus points
      eric.membershipTier = 'premium'; // 7-day free trial
      eric.subscriptionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      eric.referralCodeUsed = 'welcome'; // Mark as using welcome code
      
      await eric.save();
      
      console.log('✅ Eric\'s account updated:');
      console.log(`- Points: ${eric.points}`);
      console.log(`- Membership Tier: ${eric.membershipTier}`);
      console.log(`- Subscription Expires: ${eric.subscriptionExpires}`);
      console.log(`- Referral Code Used: ${eric.referralCodeUsed}`);
    } else {
      console.log('\n✅ Eric already has referral code used:', eric.referralCodeUsed);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

fixEricSignup();


