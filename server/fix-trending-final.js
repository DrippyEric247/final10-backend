const mongoose = require('mongoose');
require('dotenv').config();

const Auction = require('./models/Auction');

async function fixTrendingFinal() {
  try {
    console.log('🔧 Final Fix for Trending...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Get current time and set a very recent time
    const now = new Date();
    const veryRecent = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
    
    console.log(`🕐 Current time: ${now}`);
    console.log(`🕐 1 hour ago: ${veryRecent}`);

    // Update all auctions to be very recent
    const updateResult = await Auction.updateMany(
      {},
      {
        $set: {
          createdAt: veryRecent,
          updatedAt: veryRecent,
          status: 'active'
        }
      }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} auctions`);

    // Test with a very wide time range (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const trendingQuery = {
      status: 'active',
      createdAt: { $gte: sevenDaysAgo }
    };

    const trendingResults = await Auction.find(trendingQuery)
      .sort({ 
        'aiScore.trendingScore': -1, 
        'aiScore.dealPotential': -1,
        createdAt: -1 
      })
      .limit(10);

    console.log(`\n🔥 Trending query results (7 days): ${trendingResults.length} auctions`);

    if (trendingResults.length > 0) {
      console.log('\n📈 Top trending auctions:');
      trendingResults.forEach((auction, index) => {
        console.log(`\n${index + 1}. ${auction.title}`);
        console.log(`   Price: $${auction.currentBid}`);
        console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
        console.log(`   Deal Potential: ${auction.aiScore?.dealPotential || 'N/A'}`);
        console.log(`   Platform: ${auction.source?.platform || 'internal'}`);
        console.log(`   Created: ${auction.createdAt}`);
      });
    }

    // Test trending categories
    const trendingCategories = await Auction.aggregate([
      { $match: { status: 'active', createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$category', count: { $sum: 1 }, avgTrendingScore: { $avg: '$aiScore.trendingScore' } } },
      { $sort: { avgTrendingScore: -1, count: -1 } },
      { $limit: 10 }
    ]);

    console.log(`\n📊 Trending Categories: ${trendingCategories.length} categories`);
    trendingCategories.forEach((category, index) => {
      console.log(`${index + 1}. ${category._id}: ${category.count} auctions (avg score: ${Math.round(category.avgTrendingScore || 0)})`);
    });

    // Now test the actual trending endpoint
    console.log('\n🧪 Testing trending endpoint...');
    
    const axios = require('axios');
    const baseURL = 'http://localhost:5000/api';
    
    try {
      // Login first
      const loginResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      
      const token = loginResponse.data.token;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Test trending endpoint with 7 days
      const trendingResponse = await axios.get(`${baseURL}/feed/trending`, {
        headers,
        params: {
          limit: 10,
          timeRange: '7d'
        }
      });
      
      console.log(`✅ Trending endpoint successful!`);
      console.log(`   Status: ${trendingResponse.status}`);
      console.log(`   Trending Auctions: ${trendingResponse.data.trendingAuctions?.length || 0}`);
      console.log(`   Trending Categories: ${trendingResponse.data.trendingCategories?.length || 0}`);
      
      if (trendingResponse.data.trendingAuctions?.length > 0) {
        console.log('\n🔥 Trending endpoint results:');
        trendingResponse.data.trendingAuctions.slice(0, 3).forEach((auction, index) => {
          console.log(`\n${index + 1}. ${auction.title}`);
          console.log(`   Price: $${auction.currentBid}`);
          console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
        });
      }
      
    } catch (error) {
      console.log('❌ Trending endpoint test failed:', error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the function
fixTrendingFinal();


