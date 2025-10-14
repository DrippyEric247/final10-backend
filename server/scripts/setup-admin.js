const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

/**
 * Admin Setup Script
 * 
 * Creates your superadmin account for controlling SavvyShield and other admin features
 */

async function setupAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Check if superadmin already exists
    const existingSuperAdmin = await User.getSuperAdmin();
    if (existingSuperAdmin) {
      console.log('⚠️  Superadmin already exists:');
      console.log(`   Username: ${existingSuperAdmin.username}`);
      console.log(`   Email: ${existingSuperAdmin.email}`);
      console.log(`   Role: ${existingSuperAdmin.role}`);
      console.log('');
      console.log('✅ You can use this account to control SavvyShield and other admin features');
      process.exit(0);
    }
    
    // Get admin details from environment or prompt
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@savvyuniverse.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'SavvyAdmin2024!';
    
    console.log('🚀 Creating Superadmin Account...');
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('');
    
    // Create superadmin
    const superAdmin = await User.createSuperAdmin(
      adminUsername,
      adminEmail,
      adminPassword
    );
    
    console.log('✅ Superadmin account created successfully!');
    console.log('');
    console.log('🎯 Admin Account Details:');
    console.log(`   ID: ${superAdmin._id}`);
    console.log(`   Username: ${superAdmin.username}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Permissions: Full Access`);
    console.log('');
    console.log('🛡️  SavvyShield Control:');
    console.log('   ✅ Can start/stop proactive investigation');
    console.log('   ✅ Can approve/reject enforcement actions');
    console.log('   ✅ Can view all fraud events and analytics');
    console.log('   ✅ Can manage user accounts and permissions');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Login with your admin credentials');
    console.log('   2. Navigate to /shield-dashboard');
    console.log('   3. Click "Start Proactive" to activate AI fraud detection');
    console.log('   4. Monitor and manage your Savvy Universe security!');
    console.log('');
    console.log('🔥 Your AI fraud prevention army is ready to deploy!');
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the setup
if (require.main === module) {
  setupAdmin();
}

module.exports = { setupAdmin };






