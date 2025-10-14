// Migrate existing users to have the new points fields
const mongoose = require('mongoose');
const User = require('./models/User');

async function migrateUserPoints() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB');

    // Find all users that don't have pointsBalance set
    const users = await User.find({
      $or: [
        { pointsBalance: { $exists: false } },
        { lifetimePointsEarned: { $exists: false } }
      ]
    });

    console.log(`📊 Found ${users.length} users to migrate`);

    for (const user of users) {
      // Set pointsBalance to their current points value
      if (user.pointsBalance === undefined) {
        user.pointsBalance = user.points || 0;
      }
      
      // Set lifetimePointsEarned to their current points value (for now)
      if (user.lifetimePointsEarned === undefined) {
        user.lifetimePointsEarned = user.points || 0;
      }

      // Initialize badges array if it doesn't exist
      if (!user.badges) {
        user.badges = [];
      }

      // Initialize trial object if it doesn't exist
      if (!user.trial) {
        user.trial = {
          isActive: false,
          endsAt: null
        };
      }

      await user.save();
      console.log(`✅ Migrated user: ${user.username} (${user.email}) - Points: ${user.pointsBalance}`);
    }

    console.log(`🎉 Migration completed! Updated ${users.length} users.`);

  } catch (error) {
    console.error('❌ Migration error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

migrateUserPoints();

