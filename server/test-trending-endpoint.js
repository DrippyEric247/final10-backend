const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function testTrendingEndpoint() {
  try {
    console.log('🧪 Testing Trending Endpoint...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    const baseURL = 'http://localhost:5000/api';
    
    // First, get a demo user token
    console.log('🔐 Getting demo user token...');
    try {
      const loginResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Got demo user token\n');

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Test the trending endpoint
      console.log('🔥 Testing Trending Endpoint');
      console.log('=' .repeat(50));
      
      try {
        const trendingResponse = await axios.get(`${baseURL}/feed/trending`, {
          headers,
          params: {
            limit: 10,
            timeRange: '24h'
          }
        });
        
        console.log(`✅ Trending endpoint successful!`);
        console.log(`Status: ${trendingResponse.status}`);
        console.log(`Data structure:`, Object.keys(trendingResponse.data));
        
        const { trendingAuctions, trendingCategories, timeRange } = trendingResponse.data;
        
        console.log(`\n📊 Results:`);
        console.log(`   Time Range: ${timeRange}`);
        console.log(`   Trending Auctions: ${trendingAuctions?.length || 0}`);
        console.log(`   Trending Categories: ${trendingCategories?.length || 0}`);
        
        if (trendingAuctions && trendingAuctions.length > 0) {
          console.log(`\n🔥 Top Trending Auctions:`);
          trendingAuctions.slice(0, 5).forEach((auction, index) => {
            console.log(`\n${index + 1}. ${auction.title}`);
            console.log(`   Category: ${auction.category}`);
            console.log(`   Price: $${auction.currentBid}`);
            console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
            console.log(`   Deal Potential: ${auction.aiScore?.dealPotential || 'N/A'}`);
            console.log(`   Platform: ${auction.source?.platform || 'internal'}`);
          });
        } else {
          console.log(`\n❌ No trending auctions found`);
        }
        
        if (trendingCategories && trendingCategories.length > 0) {
          console.log(`\n📈 Trending Categories:`);
          trendingCategories.forEach((category, index) => {
            console.log(`${index + 1}. ${category._id}: ${category.count} auctions (avg score: ${Math.round(category.avgTrendingScore || 0)})`);
          });
        } else {
          console.log(`\n❌ No trending categories found`);
        }
        
      } catch (error) {
        console.log('❌ Trending endpoint failed:', error.response?.data?.message || error.message);
        console.log('Status:', error.response?.status);
        console.log('Response:', error.response?.data);
      }

    } catch (loginError) {
      console.log('❌ Login failed:', loginError.response?.data?.message || loginError.message);
      console.log('This might be why the trending tab shows no data - user not authenticated');
    }

    console.log('\n🎉 Trending Endpoint Test Complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the test
testTrendingEndpoint();
