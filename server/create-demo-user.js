const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

async function createDemoUser() {
  try {
    console.log('🔧 Creating Demo User...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Check if demo user already exists
    let demoUser = await User.findOne({ username: 'demo' });
    
    if (demoUser) {
      console.log('✅ Demo user already exists');
      console.log(`   Username: ${demoUser.username}`);
      console.log(`   Email: ${demoUser.email}`);
      console.log(`   Points: ${demoUser.points}`);
      console.log(`   Membership: ${demoUser.membershipTier}`);
    } else {
      console.log('🔧 Creating new demo user...');
      
      // Hash the password
      const passwordHash = await bcrypt.hash('demo123', 10);
      
      // Create demo user
      demoUser = await User.create({
        firstName: 'Demo',
        lastName: 'User',
        username: 'demo',
        email: 'demo@final10.com',
        password: passwordHash,
        points: 500,
        membershipTier: 'free',
        lastActive: new Date(),
        referralCode: 'demo123'
      });
      
      console.log('✅ Demo user created successfully!');
      console.log(`   Username: ${demoUser.username}`);
      console.log(`   Email: ${demoUser.email}`);
      console.log(`   Points: ${demoUser.points}`);
      console.log(`   Membership: ${demoUser.membershipTier}`);
    }

    // Test login
    console.log('\n🔐 Testing login...');
    const isPasswordValid = await bcrypt.compare('demo123', demoUser.password);
    if (isPasswordValid) {
      console.log('✅ Password verification successful');
    } else {
      console.log('❌ Password verification failed');
    }

    console.log('\n📋 Demo User Credentials:');
    console.log('   Username: demo');
    console.log('   Password: demo123');
    console.log('   Email: demo@final10.com');

  } catch (error) {
    console.error('❌ Failed to create demo user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the function
createDemoUser();


