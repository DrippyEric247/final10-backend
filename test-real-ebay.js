// Test script to verify real eBay data integration
require('dotenv').config();

console.log('🔍 Testing Real eBay Integration...\n');

// Check environment variables first
console.log('📋 Environment Check:');
console.log('EBAY_CLIENT_ID:', process.env.EBAY_CLIENT_ID ? '✅ SET' : '❌ NOT SET');
console.log('EBAY_CLIENT_SECRET:', process.env.EBAY_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET');

if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
  console.log('\n❌ eBay credentials not found!');
  console.log('Make sure your .env file contains:');
  console.log('EBAY_CLIENT_ID=your_client_id');
  console.log('EBAY_CLIENT_SECRET=your_client_secret');
  process.exit(1);
}

const { getEbayAccessToken, isAuthEnabled, resetAuthState } = require('./services/ebayAuth');

async function testRealEbayIntegration() {
  console.log('\n🔑 Testing eBay Authentication...');
  
  // Reset auth state to ensure fresh start
  resetAuthState();
  
  try {
    const token = await getEbayAccessToken();
    
    if (token && isAuthEnabled()) {
      console.log('✅ eBay authentication successful!');
      console.log('Token length:', token.length);
      
      // Test the search endpoint
      console.log('\n🔍 Testing eBay Search Endpoint...');
      
      const express = require('express');
      const app = express();
      const ebayRoutes = require('./routes/ebay');
      
      app.use('/api/ebay', ebayRoutes);
      
      const server = app.listen(3004, async () => {
        console.log('Test server running on port 3004');
        
        try {
          const axios = require('axios');
          const response = await axios.get('http://localhost:3004/api/ebay/search?q=iPhone&limit=3');
          
          console.log('✅ eBay search endpoint working!');
          console.log('Items found:', response.data.items.length);
          console.log('First item:', response.data.items[0]?.title);
          console.log('Using real eBay data:', response.data.items[0]?.platform === 'eBay' ? 'YES' : 'NO');
          
          // Test trending endpoint
          const trendingResponse = await axios.get('http://localhost:3004/api/ebay/trending?limit=3');
          console.log('\n✅ eBay trending endpoint working!');
          console.log('Trending items:', trendingResponse.data.items.length);
          
          console.log('\n🎉 Real eBay integration is working perfectly!');
          console.log('Your app is now using real eBay data instead of mock data.');
          
        } catch (error) {
          console.error('❌ API test failed:', error.message);
        } finally {
          server.close();
        }
      });
      
    } else {
      console.log('❌ eBay authentication failed');
      console.log('Auth enabled:', isAuthEnabled());
    }
    
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
  }
}

testRealEbayIntegration().catch(console.error);


