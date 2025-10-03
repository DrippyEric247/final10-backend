const mongoose = require('mongoose');
require('dotenv').config();

const Auction = require('./models/Auction');

async function fixAuctionDates() {
  try {
    console.log('🔧 Fixing Auction Dates...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Get all auctions
    const auctions = await Auction.find({});
    console.log(`📊 Found ${auctions.length} auctions`);

    if (auctions.length === 0) {
      console.log('❌ No auctions found to update');
      return;
    }

    // Update auction dates to be recent (within last 24 hours)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    let updatedCount = 0;

    for (let i = 0; i < auctions.length; i++) {
      const auction = auctions[i];
      
      // Set createdAt to a random time within the last 24 hours
      const randomTime = new Date(oneDayAgo.getTime() + Math.random() * (now.getTime() - oneDayAgo.getTime()));
      
      // Update the auction
      await Auction.updateOne(
        { _id: auction._id },
        { 
          $set: { 
            createdAt: randomTime,
            updatedAt: randomTime
          }
        }
      );
      
      updatedCount++;
      console.log(`✅ Updated auction ${i + 1}: ${auction.title}`);
    }

    console.log(`\n🎉 Updated ${updatedCount} auctions with recent dates`);

    // Verify the updates
    console.log('\n📊 Verifying updates...');
    const recentAuctions = await Auction.find({
      createdAt: { $gte: oneDayAgo }
    }).sort({ createdAt: -1 });

    console.log(`✅ Found ${recentAuctions.length} auctions created within last 24 hours:`);
    recentAuctions.slice(0, 5).forEach((auction, index) => {
      console.log(`\n${index + 1}. ${auction.title}`);
      console.log(`   Created: ${auction.createdAt}`);
      console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
      console.log(`   Platform: ${auction.source?.platform || 'internal'}`);
    });

  } catch (error) {
    console.error('❌ Failed to fix auction dates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the function
fixAuctionDates();


