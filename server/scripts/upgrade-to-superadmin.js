const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function upgradeToSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('🔗 Connected to MongoDB');
    
    // Find the admin user
    const adminUser = await User.findOne({ username: 'admin' });
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }
    
    console.log('👤 Found admin user:');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Current Role: ${adminUser.role || 'user'}`);
    console.log(`   ID: ${adminUser._id}`);
    
    // Upgrade to superadmin
    adminUser.role = 'superadmin';
    adminUser.adminPermissions = {
      canManageShield: true,
      canManageUsers: true,
      canManagePromotions: true,
      canManagePayments: true,
      canViewAnalytics: true
    };
    adminUser.membershipTier = 'pro';
    adminUser.isPremium = true;
    
    await adminUser.save();
    
    console.log('\n✅ Successfully upgraded to superadmin!');
    console.log('\n🎯 Your Superadmin Account:');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log(`   Permissions: Full Access`);
    console.log(`   Membership: Pro (Premium)`);
    
    console.log('\n🛡️  SavvyShield Control:');
    console.log('   ✅ Can start/stop proactive investigation');
    console.log('   ✅ Can approve/reject enforcement actions');
    console.log('   ✅ Can view all fraud events and analytics');
    console.log('   ✅ Can manage user accounts and permissions');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Login with your admin credentials');
    console.log('   2. Navigate to /shield-dashboard');
    console.log('   3. Click "Start Proactive" to activate AI fraud detection');
    console.log('   4. Monitor and manage your Savvy Universe security!');
    
    console.log('\n🔥 Your AI fraud prevention army is ready to deploy!');
    
  } catch (error) {
    console.error('❌ Error upgrading to superadmin:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

upgradeToSuperAdmin();






