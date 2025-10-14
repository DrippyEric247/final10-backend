const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Check for existing admin users
    const adminUsers = await User.find({ 
      $or: [
        { role: 'admin' },
        { role: 'superadmin' },
        { username: 'admin' }
      ]
    });
    
    console.log('👥 Found admin users:');
    adminUsers.forEach((user, index) => {
      console.log(`\n${index + 1}. Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role || 'user'}`);
      console.log(`   ID: ${user._id}`);
      
      if (user.role === 'superadmin') {
        console.log('   ✅ Already superadmin - ready to control SavvyShield!');
      } else if (user.role === 'admin') {
        console.log('   ⚠️  Regular admin - needs superadmin upgrade');
      } else {
        console.log('   ❌ Not an admin - needs role upgrade');
      }
    });
    
    // Check for superadmin specifically
    const superAdmin = await User.getSuperAdmin();
    if (superAdmin) {
      console.log('\n🎯 Superadmin found!');
      console.log(`   Username: ${superAdmin.username}`);
      console.log(`   Email: ${superAdmin.email}`);
      console.log(`   Can manage Shield: ${superAdmin.canManageShield()}`);
      console.log('\n✅ You can now control SavvyShield!');
      console.log('   - Login with your superadmin account');
      console.log('   - Navigate to /shield-dashboard');
      console.log('   - Click "Start Proactive" to activate AI fraud detection');
    } else {
      console.log('\n❌ No superadmin found');
      console.log('   Run: node scripts/upgrade-to-superadmin.js');
    }
    
  } catch (error) {
    console.error('❌ Error checking admin:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

checkAdmin();






