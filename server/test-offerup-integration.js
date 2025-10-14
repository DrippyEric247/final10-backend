const mongoose = require('mongoose');
require('dotenv').config();

const SimpleScraper = require('./services/scrapers/SimpleScraper');
const AuctionAggregator = require('./services/AuctionAggregator');

async function testOfferUpIntegration() {
  try {
    console.log('🧪 Testing OfferUp Integration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    const scraper = new SimpleScraper();
    const aggregator = new AuctionAggregator();

    // Test 1: Direct OfferUp scraper
    console.log('📱 Test 1: Direct OfferUp Scraper');
    console.log('=' .repeat(50));
    
    const offerUpResults = await scraper.searchOfferUp('iPhone', 3);
    console.log(`Found ${offerUpResults.length} OfferUp results:`);
    
    offerUpResults.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.title}`);
      console.log(`   Price: $${item.currentBid}`);
      console.log(`   Platform: ${item.platform}`);
      console.log(`   Location: ${item.location}`);
      console.log(`   Deal Score: ${item.dealPotential}/100`);
      console.log(`   Local: ${item.isLocal ? 'Yes' : 'No'}`);
      console.log(`   URL: ${item.itemUrl}`);
    });

    // Test 2: Auction Aggregator with OfferUp
    console.log('\n\n🔍 Test 2: Auction Aggregator (All Platforms)');
    console.log('=' .repeat(50));
    
    const allResults = await aggregator.searchAllPlatforms('iPhone', 2);
    console.log(`\nTotal results from all platforms: ${allResults.length}`);
    
    // Group by platform
    const byPlatform = allResults.reduce((acc, item) => {
      if (!acc[item.platform]) acc[item.platform] = [];
      acc[item.platform].push(item);
      return acc;
    }, {});

    Object.entries(byPlatform).forEach(([platform, items]) => {
      console.log(`\n${platform.toUpperCase()}: ${items.length} results`);
      items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.title} - $${item.currentBid}`);
        if (item.isLocal) {
          console.log(`     🏠 Local deal: ${item.location}`);
        }
      });
    });

    // Test 3: Local deals advantages
    console.log('\n\n🏪 Test 3: Local Deals Advantages');
    console.log('=' .repeat(50));
    
    const localDeals = allResults.filter(item => item.isLocal);
    console.log(`Found ${localDeals.length} local deals with advantages:`);
    
    localDeals.forEach((deal, index) => {
      console.log(`\n${index + 1}. ${deal.title}`);
      console.log(`   💰 Price: $${deal.currentBid}`);
      console.log(`   📍 Location: ${deal.location}`);
      console.log(`   🚗 Pickup Available: Yes`);
      console.log(`   📦 No Shipping: Yes`);
      console.log(`   ⚡ Instant Buy: Yes`);
      console.log(`   🤝 Negotiation: Yes`);
      console.log(`   🎯 Deal Score: ${deal.dealPotential}/100`);
    });

    // Test 4: Search expansion benefits
    console.log('\n\n📈 Test 4: Search Database Expansion');
    console.log('=' .repeat(50));
    
    const platformCounts = Object.keys(byPlatform).length;
    const totalResults = allResults.length;
    const localResults = localDeals.length;
    
    console.log(`Platforms searched: ${platformCounts}`);
    console.log(`Total results: ${totalResults}`);
    console.log(`Local results: ${localResults}`);
    console.log(`Expansion benefit: +${localResults} local deals (${Math.round((localResults/totalResults)*100)}% of total)`);
    
    if (localResults > 0) {
      console.log('\n✅ Benefits of adding OfferUp:');
      console.log('   • Expanded search database');
      console.log('   • Local pickup options');
      console.log('   • No shipping costs');
      console.log('   • Cash negotiation opportunities');
      console.log('   • Same-day availability');
    }

    console.log('\n🎉 OfferUp Integration Test Complete!');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the test
testOfferUpIntegration();


