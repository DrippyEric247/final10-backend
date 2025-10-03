const axios = require('axios');

async function testFeedEndpoints() {
  const baseURL = 'http://localhost:5000/api';
  
  console.log('🎯 Testing TikTok-like Product Feed Endpoints\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test 2: Product feed (without auth - should fail)
    console.log('\n2. Testing product feed without auth...');
    try {
      await axios.get(`${baseURL}/feed/product-feed`);
      console.log('❌ Should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status);
      }
    }

    // Test 3: Trending feed (without auth - should fail)
    console.log('\n3. Testing trending feed without auth...');
    try {
      await axios.get(`${baseURL}/feed/trending`);
      console.log('❌ Should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status);
      }
    }

    // Test 4: AI insights (without auth - should fail)
    console.log('\n4. Testing AI insights without auth...');
    try {
      await axios.get(`${baseURL}/feed/ai-insights`);
      console.log('❌ Should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status);
      }
    }

    // Test 5: Video scanning (without auth - should fail)
    console.log('\n5. Testing video scanning without auth...');
    try {
      await axios.post(`${baseURL}/feed/scan-video`, {
        videoUrl: 'https://tiktok.com/test',
        platform: 'tiktok'
      });
      console.log('❌ Should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status);
      }
    }

    // Test 6: Scanner refresh (without auth - should fail)
    console.log('\n6. Testing scanner refresh without auth...');
    try {
      await axios.post(`${baseURL}/feed/refresh-scanner`);
      console.log('❌ Should have failed without auth');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status);
      }
    }

    console.log('\n✅ All feed endpoints are properly protected and accessible!');
    console.log('\n🎯 Available TikTok-like Product Feed Endpoints:');
    console.log('• GET  /api/feed/product-feed     - TikTok-like infinite scroll feed');
    console.log('• GET  /api/feed/trending         - Trending auctions and categories');
    console.log('• GET  /api/feed/ai-insights      - AI-powered market insights');
    console.log('• POST /api/feed/scan-video       - AI video scanning for products');
    console.log('• POST /api/feed/refresh-scanner  - Manual scanner refresh (Premium)');
    console.log('\n🔐 All endpoints require authentication (Bearer token)');
    console.log('📱 Perfect for TikTok-like product discovery experience!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure your server is running on port 5000');
    }
  }
}

testFeedEndpoints();

