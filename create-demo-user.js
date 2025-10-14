// Create demo user for testing
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createDemoUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Check if demo user exists
    const existingUser = await User.findOne({ email: 'demo@final10.com' });
    if (existingUser) {
      console.log('👤 Demo user already exists:', existingUser.email);
      console.log('🔑 Resetting password...');
      
      // Reset password
      const passwordHash = await bcrypt.hash('demo123', 10);
      existingUser.password = passwordHash;
      await existingUser.save();
      console.log('✅ Password reset successfully');
    } else {
      console.log('👤 Creating demo user...');
      
      // Create demo user
      const passwordHash = await bcrypt.hash('demo123', 10);
      const demoUser = new User({
        firstName: 'Demo',
        lastName: 'User',
        username: 'demo',
        email: 'demo@final10.com',
        password: passwordHash,
        points: 1000,
        lastActive: new Date(),
        membershipTier: 'free'
      });
      
      await demoUser.save();
      console.log('✅ Demo user created successfully');
    }

    // Test login
    console.log('\n🧪 Testing login...');
    const testUser = await User.findOne({ email: 'demo@final10.com' });
    const isMatch = await bcrypt.compare('demo123', testUser.password);
    
    if (isMatch) {
      console.log('✅ Login test successful!');
      console.log('📧 Email:', testUser.email);
      console.log('👤 Username:', testUser.username);
      console.log('💰 Points:', testUser.points);
    } else {
      console.log('❌ Login test failed!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

createDemoUser();
