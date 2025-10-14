const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createWelcomeUser() {
  try {
    console.log('🎯 Creating user with "welcome" referral code...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to database');
    
    // Check if welcome user already exists
    const existingWelcome = await User.findOne({ referralCode: 'welcome' });
    if (existingWelcome) {
      console.log('✅ User with "welcome" referral code already exists:');
      console.log(`- Username: ${existingWelcome.username}`);
      console.log(`- Email: ${existingWelcome.email}`);
      console.log(`- Points: ${existingWelcome.points}`);
      return;
    }
    
    // Create welcome user
    const passwordHash = await bcrypt.hash('welcome123', 10);
    const welcomeUser = await User.create({
      firstName: 'Welcome',
      lastName: 'User',
      username: 'welcome_user',
      email: 'welcome@final10.app',
      password: passwordHash,
      points: 1000,
      referralCode: 'welcome', // Set the specific referral code
      membershipTier: 'free',
      lastActive: new Date()
    });
    
    console.log('✅ Created welcome user:');
    console.log(`- Username: ${welcomeUser.username}`);
    console.log(`- Email: ${welcomeUser.email}`);
    console.log(`- Referral Code: ${welcomeUser.referralCode}`);
    console.log(`- Points: ${welcomeUser.points}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

createWelcomeUser();


