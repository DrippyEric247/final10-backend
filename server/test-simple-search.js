const AuctionAggregator = require('./services/AuctionAggregator');

async function testSimpleSearch() {
  try {
    console.log('🧪 Testing simple live auction search...');
    
    const aggregator = new AuctionAggregator();
    
    // Test search for iPhone
    console.log('\n📱 Testing iPhone search...');
    const iphoneResults = await aggregator.getOneFromEach('iPhone');
    console.log(`Found ${iphoneResults.length} results:`);
    iphoneResults.forEach((result, index) => {
      console.log(`${index + 1}. [${result.source.platform.toUpperCase()}] ${result.title} - $${result.currentBid}`);
      console.log(`   Deal Potential: ${result.aiScore.dealPotential}%, Trending: ${result.aiScore.trendingScore}%`);
    });
    
    console.log('\n✅ Simple search test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSimpleSearch();
