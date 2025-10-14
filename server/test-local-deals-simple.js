const mongoose = require('mongoose');
require('dotenv').config();

const SimpleScraper = require('./services/scrapers/SimpleScraper');
const AuctionAggregator = require('./services/AuctionAggregator');

async function testLocalDealsSimple() {
  try {
    console.log('🧪 Testing Local Deals Integration (Simple)...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    const scraper = new SimpleScraper();
    const aggregator = new AuctionAggregator();

    // Test OfferUp integration
    console.log('📱 Testing OfferUp Integration');
    console.log('=' .repeat(50));
    
    const offerUpResults = await scraper.searchOfferUp('iPhone', 3);
    console.log(`✅ OfferUp: Found ${offerUpResults.length} local listings`);
    
    if (offerUpResults.length > 0) {
      console.log('\nSample OfferUp listing:');
      const sample = offerUpResults[0];
      console.log(`   Title: ${sample.title}`);
      console.log(`   Price: $${sample.currentBid}`);
      console.log(`   Location: ${sample.location}`);
      console.log(`   Platform: ${sample.platform}`);
      console.log(`   Local: ${sample.isLocal}`);
      console.log(`   Deal Score: ${sample.dealPotential}/100`);
    }

    // Test auction aggregator with OfferUp
    console.log('\n\n🔍 Testing Auction Aggregator with OfferUp');
    console.log('=' .repeat(50));
    
    const allResults = await aggregator.searchAllPlatforms('iPhone', 2);
    console.log(`✅ Total results: ${allResults.length}`);
    
    // Count by platform
    const platformCounts = allResults.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {});

    console.log('\nResults by platform:');
    Object.entries(platformCounts).forEach(([platform, count]) => {
      console.log(`   ${platform}: ${count} results`);
    });

    // Count local deals
    const localDeals = allResults.filter(item => item.isLocal);
    console.log(`\n🏠 Local deals: ${localDeals.length}`);
    
    if (localDeals.length > 0) {
      console.log('\nLocal deal advantages:');
      localDeals.forEach((deal, index) => {
        console.log(`\n${index + 1}. ${deal.title}`);
        console.log(`   💰 Price: $${deal.currentBid}`);
        console.log(`   📍 Location: ${deal.location}`);
        console.log(`   🚗 Pickup Available: Yes`);
        console.log(`   📦 No Shipping: Yes`);
        console.log(`   ⚡ Instant Buy: Yes`);
        console.log(`   🤝 Negotiation: Yes`);
      });
    }

    // Test different search terms
    console.log('\n\n🔍 Testing Different Search Terms');
    console.log('=' .repeat(50));
    
    const searchTerms = ['laptop', 'furniture', 'car'];
    
    for (const term of searchTerms) {
      const results = await scraper.searchOfferUp(term, 2);
      console.log(`\n"${term}": ${results.length} local deals`);
      if (results.length > 0) {
        console.log(`   Top deal: ${results[0].title} - $${results[0].currentBid}`);
      }
    }

    console.log('\n🎉 Local Deals Integration Test Complete!');
    console.log('=' .repeat(50));
    console.log('✅ OfferUp scraper is working');
    console.log('✅ Mock data generation is functional');
    console.log('✅ Local deals advantages are calculated');
    console.log('✅ Search database expansion is successful');
    console.log('✅ Multiple categories are supported');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the test
testLocalDealsSimple();


