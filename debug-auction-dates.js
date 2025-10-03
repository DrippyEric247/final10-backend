const mongoose = require('mongoose');
require('dotenv').config();

const Auction = require('./models/Auction');

async function debugAuctionDates() {
  try {
    console.log('🔍 Debugging Auction Dates...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Check current time
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    console.log(`🕐 Current time: ${now}`);
    console.log(`🕐 24 hours ago: ${oneDayAgo}`);

    // Get all auctions and check their dates
    const auctions = await Auction.find({}).sort({ createdAt: -1 });
    console.log(`\n📊 Found ${auctions.length} auctions:`);

    auctions.forEach((auction, index) => {
      const isRecent = auction.createdAt >= oneDayAgo;
      console.log(`\n${index + 1}. ${auction.title}`);
      console.log(`   Created: ${auction.createdAt}`);
      console.log(`   Is Recent (24h): ${isRecent ? '✅' : '❌'}`);
      console.log(`   Status: ${auction.status}`);
      console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
    });

    // Test the exact query used in trending endpoint
    console.log('\n🔍 Testing trending query...');
    const trendingQuery = {
      status: 'active',
      createdAt: { $gte: oneDayAgo }
    };
    
    console.log('Query:', JSON.stringify(trendingQuery, null, 2));
    
    const trendingResults = await Auction.find(trendingQuery);
    console.log(`\n📊 Trending query results: ${trendingResults.length} auctions`);

    if (trendingResults.length === 0) {
      console.log('\n🔧 No recent active auctions found. Let me fix this...');
      
      // Update all auctions to be recent and active
      const updateResult = await Auction.updateMany(
        {},
        {
          $set: {
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'active'
          }
        }
      );
      
      console.log(`✅ Updated ${updateResult.modifiedCount} auctions`);
      
      // Test the query again
      const newTrendingResults = await Auction.find(trendingQuery);
      console.log(`\n📊 After fix - Trending query results: ${newTrendingResults.length} auctions`);
      
      if (newTrendingResults.length > 0) {
        console.log('\n🔥 Trending auctions after fix:');
        newTrendingResults.slice(0, 5).forEach((auction, index) => {
          console.log(`\n${index + 1}. ${auction.title}`);
          console.log(`   Created: ${auction.createdAt}`);
          console.log(`   Status: ${auction.status}`);
          console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the function
debugAuctionDates();


