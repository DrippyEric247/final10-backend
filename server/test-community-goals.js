const mongoose = require('mongoose');
const User = require('./models/User');
const Alert = require('./models/Alert');
const Auction = require('./models/Auction');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/final10';

async function testCommunityGoals() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test community goals calculation
    console.log('\n🔍 Testing Community Goals...');

    // Calculate total savvy points across all users
    const totalSavvyPoints = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$savvyPoints' } } }
    ]);
    console.log(`Total Savvy Points: ${totalSavvyPoints[0]?.total || 0}`);

    // Count total active alerts
    const activeAlertsCount = await Alert.countDocuments({ isActive: true });
    console.log(`Active Alerts: ${activeAlertsCount}`);

    // Count total auctions won
    const auctionsWonCount = await Auction.countDocuments({ status: 'completed' });
    console.log(`Auctions Won: ${auctionsWonCount}`);

    // Calculate total time saved (assuming 1 hour per transaction)
    const totalTransactions = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalTransactions' } } }
    ]);
    const timeSaved = (totalTransactions[0]?.total || 0) * 1;
    console.log(`Time Saved: ${timeSaved} hours`);

    // Check community goals
    const goals = {
      savvyPoints: { target: 1000000 },
      activeAlerts: { target: 100000 },
      auctionsWon: { target: 100000 },
      timeSaved: { target: 8760 }
    };

    console.log('\n📊 Community Goals Progress:');
    console.log(`Savvy Points: ${totalSavvyPoints[0]?.total || 0} / ${goals.savvyPoints.target} (${((totalSavvyPoints[0]?.total || 0) / goals.savvyPoints.target * 100).toFixed(1)}%)`);
    console.log(`Active Alerts: ${activeAlertsCount} / ${goals.activeAlerts.target} (${(activeAlertsCount / goals.activeAlerts.target * 100).toFixed(1)}%)`);
    console.log(`Auctions Won: ${auctionsWonCount} / ${goals.auctionsWon.target} (${(auctionsWonCount / goals.auctionsWon.target * 100).toFixed(1)}%)`);
    console.log(`Time Saved: ${timeSaved} / ${goals.timeSaved.target} (${(timeSaved / goals.timeSaved.target * 100).toFixed(1)}%)`);

    // Check if any goals are completed
    const completedGoals = [];
    if ((totalSavvyPoints[0]?.total || 0) >= goals.savvyPoints.target) completedGoals.push('Savvy Points');
    if (activeAlertsCount >= goals.activeAlerts.target) completedGoals.push('Active Alerts');
    if (auctionsWonCount >= goals.auctionsWon.target) completedGoals.push('Auctions Won');
    if (timeSaved >= goals.timeSaved.target) completedGoals.push('Time Saved');

    if (completedGoals.length > 0) {
      console.log(`\n🎉 Completed Goals: ${completedGoals.join(', ')}`);
      console.log('✅ Community rewards are available!');
    } else {
      console.log('\n⏳ No goals completed yet - keep going!');
    }

    // Test user reward eligibility
    const testUser = await User.findOne({});
    if (testUser) {
      console.log(`\n👤 Test User: ${testUser.username}`);
      console.log(`Has claimed community reward: ${testUser.hasClaimedCommunityReward}`);
      console.log(`Is Premium: ${testUser.isPremium}`);
      console.log(`Savvy Points: ${testUser.savvyPoints}`);
    }

    console.log('\n✅ Community goals test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing community goals:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

testCommunityGoals();
