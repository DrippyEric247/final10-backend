const mongoose = require('mongoose');
const User = require('./models/User');

async function checkAllUsers() {
  try {
    console.log('🔍 Checking all users in database...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to database');
    
    // Get all users
    const users = await User.find({}).sort({ createdAt: -1 });
    
    console.log(`\n👥 Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. ${user.username} (${user.email})`);
      console.log(`   - Points: ${user.points}`);
      console.log(`   - Tier: ${user.membershipTier}`);
      console.log(`   - Referral Code: ${user.referralCode || 'None'}`);
      console.log(`   - Used Referral: ${user.referralCodeUsed || 'None'}`);
      console.log(`   - Created: ${user.createdAt}`);
    });
    
    // Check for "welcome" referral code specifically
    const welcomeUser = await User.findOne({ referralCode: 'welcome' });
    if (welcomeUser) {
      console.log('\n🎯 User with "welcome" referral code:');
      console.log(`- Username: ${welcomeUser.username}`);
      console.log(`- Email: ${welcomeUser.email}`);
      console.log(`- Points: ${welcomeUser.points}`);
    } else {
      console.log('\n❌ No user found with "welcome" referral code');
    }
    
    // Check for users who used "welcome" referral code
    const usersWithWelcome = await User.find({ referralCodeUsed: 'welcome' });
    console.log(`\n👥 Users who used "welcome" referral code (${usersWithWelcome.length}):`);
    usersWithWelcome.forEach(user => {
      console.log(`- ${user.username} (${user.email}) - ${user.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

checkAllUsers();


