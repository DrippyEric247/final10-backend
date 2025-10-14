const axios = require('axios');

async function testAuctionEndpoints() {
  const baseURL = 'http://localhost:5000/api';
  
  try {
    console.log('🧪 Testing Auction Endpoints...\n');
    
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    
    // Test browse auctions endpoint
    console.log('\n2. Testing browse auctions endpoint...');
    const auctionsResponse = await axios.get(`${baseURL}/auctions`);
    console.log('✅ Browse auctions response:');
    console.log(`   - Found ${auctionsResponse.data.auctions.length} auctions`);
    console.log(`   - Total pages: ${auctionsResponse.data.pagination.pages}`);
    console.log(`   - Total auctions: ${auctionsResponse.data.pagination.total}`);
    
    // Test trending auctions endpoint
    console.log('\n3. Testing trending auctions endpoint...');
    const trendingResponse = await axios.get(`${baseURL}/auctions/trending/auctions`);
    console.log('✅ Trending auctions response:');
    console.log(`   - Found ${trendingResponse.data.auctions.length} trending auctions`);
    
    // Test ending soon auctions endpoint
    console.log('\n4. Testing ending soon auctions endpoint...');
    const endingSoonResponse = await axios.get(`${baseURL}/auctions/ending-soon/auctions`);
    console.log('✅ Ending soon auctions response:');
    console.log(`   - Found ${endingSoonResponse.data.auctions.length} auctions ending soon`);
    
    // Test deals endpoint
    console.log('\n5. Testing deals endpoint...');
    const dealsResponse = await axios.get(`${baseURL}/auctions/deals/auctions`);
    console.log('✅ Deals response:');
    console.log(`   - Found ${dealsResponse.data.auctions.length} high deal potential auctions`);
    
    // Test filtered search
    console.log('\n6. Testing filtered search...');
    const filteredResponse = await axios.get(`${baseURL}/auctions?category=electronics&limit=5`);
    console.log('✅ Filtered search response:');
    console.log(`   - Found ${filteredResponse.data.auctions.length} electronics auctions`);
    
    console.log('\n🎉 All auction endpoints are working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing endpoints:', error.response?.data || error.message);
  }
}

// Run the test
testAuctionEndpoints();
