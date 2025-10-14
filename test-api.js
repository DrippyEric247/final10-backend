const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing API endpoints...');
    
    // Test trending endpoint
    console.log('\n1. Testing /api/feed/trending...');
    try {
      const response = await axios.get('http://localhost:5000/api/feed/trending');
      console.log('✅ Trending endpoint working');
      console.log('Response structure:', Object.keys(response.data));
      console.log('Trending auctions count:', response.data.trendingAuctions?.length || 0);
      console.log('Trending categories count:', response.data.trendingCategories?.length || 0);
    } catch (error) {
      console.log('❌ Trending endpoint error:', error.response?.status, error.response?.data?.message || error.message);
    }
    
    // Test product-feed endpoint
    console.log('\n2. Testing /api/feed/product-feed...');
    try {
      const response = await axios.get('http://localhost:5000/api/feed/product-feed');
      console.log('✅ Product feed endpoint working');
      console.log('Response structure:', Object.keys(response.data));
      console.log('Items count:', response.data.items?.length || 0);
    } catch (error) {
      console.log('❌ Product feed endpoint error:', error.response?.status, error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAPI();

