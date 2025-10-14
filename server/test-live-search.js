const AuctionAggregator = require('./services/AuctionAggregator');
require('dotenv').config();

async function testLiveSearch() {
  try {
    console.log('🧪 Testing live auction search...');
    
    const aggregator = new AuctionAggregator();
    
    // Test search for iPhone
    console.log('\n📱 Testing iPhone search...');
    const iphoneResults = await aggregator.getOneFromEach('iPhone');
    console.log(`Found ${iphoneResults.length} results:`);
    iphoneResults.forEach((result, index) => {
      console.log(`${index + 1}. [${result.source.platform.toUpperCase()}] ${result.title} - $${result.currentBid}`);
    });
    
    // Test search for Nike shoes
    console.log('\n👟 Testing Nike search...');
    const nikeResults = await aggregator.getOneFromEach('Nike shoes');
    console.log(`Found ${nikeResults.length} results:`);
    nikeResults.forEach((result, index) => {
      console.log(`${index + 1}. [${result.source.platform.toUpperCase()}] ${result.title} - $${result.currentBid}`);
    });
    
    console.log('\n✅ Live search test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLiveSearch();
