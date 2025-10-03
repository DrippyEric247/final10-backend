const mongoose = require('mongoose');
require('dotenv').config();

const Auction = require('./models/Auction');

async function fixTrendingIssue() {
  try {
    console.log('🔧 Fixing Trending Issue...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Get all auctions
    const auctions = await Auction.find({});
    console.log(`📊 Found ${auctions.length} auctions`);

    if (auctions.length === 0) {
      console.log('❌ No auctions found');
      return;
    }

    // Check the first auction to see its structure
    const firstAuction = auctions[0];
    console.log('\n🔍 First auction structure:');
    console.log('Fields:', Object.keys(firstAuction.toObject()));
    console.log('createdAt:', firstAuction.createdAt);
    console.log('updatedAt:', firstAuction.updatedAt);
    console.log('startTime:', firstAuction.startTime);

    // Update all auctions to have proper timestamps
    const now = new Date();
    const updateResult = await Auction.updateMany(
      {},
      {
        $set: {
          createdAt: now,
          updatedAt: now,
          status: 'active'
        }
      }
    );

    console.log(`\n✅ Updated ${updateResult.modifiedCount} auctions with current timestamp`);

    // Verify the update
    const updatedAuctions = await Auction.find({}).limit(3);
    console.log('\n📊 Updated auctions:');
    updatedAuctions.forEach((auction, index) => {
      console.log(`\n${index + 1}. ${auction.title}`);
      console.log(`   Created: ${auction.createdAt}`);
      console.log(`   Status: ${auction.status}`);
      console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
    });

    // Test the trending query
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const trendingQuery = {
      status: 'active',
      createdAt: { $gte: oneDayAgo }
    };

    const trendingResults = await Auction.find(trendingQuery);
    console.log(`\n🔥 Trending query results: ${trendingResults.length} auctions`);

    if (trendingResults.length > 0) {
      console.log('\n📈 Top trending auctions:');
      trendingResults.slice(0, 5).forEach((auction, index) => {
        console.log(`\n${index + 1}. ${auction.title}`);
        console.log(`   Price: $${auction.currentBid}`);
        console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
        console.log(`   Deal Potential: ${auction.aiScore?.dealPotential || 'N/A'}`);
        console.log(`   Platform: ${auction.source?.platform || 'internal'}`);
      });
    }

    // Test trending categories
    const trendingCategories = await Auction.aggregate([
      { $match: { status: 'active', createdAt: { $gte: oneDayAgo } } },
      { $group: { _id: '$category', count: { $sum: 1 }, avgTrendingScore: { $avg: '$aiScore.trendingScore' } } },
      { $sort: { avgTrendingScore: -1, count: -1 } },
      { $limit: 10 }
    ]);

    console.log(`\n📊 Trending Categories: ${trendingCategories.length} categories`);
    trendingCategories.forEach((category, index) => {
      console.log(`${index + 1}. ${category._id}: ${category.count} auctions (avg score: ${Math.round(category.avgTrendingScore || 0)})`);
    });

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the function
fixTrendingIssue();


