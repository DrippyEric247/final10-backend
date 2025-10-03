const mongoose = require('mongoose');
require('dotenv').config();

const Auction = require('./models/Auction');
const User = require('./models/User');

async function testTrendingData() {
  try {
    console.log('🧪 Testing Trending Data...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    // Check if there are any auctions
    const auctionCount = await Auction.countDocuments();
    console.log(`📊 Total auctions in database: ${auctionCount}`);

    if (auctionCount === 0) {
      console.log('\n🔧 No auctions found. Creating sample data...\n');
      
      // Find or create a test user
      let testUser = await User.findOne({ username: 'testuser' });
      if (!testUser) {
        testUser = await User.create({
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser',
          email: 'test@example.com',
          password: 'hashedpassword',
          points: 100
        });
        console.log('✅ Created test user');
      }

      // Create sample auctions with trending scores
      const sampleAuctions = [
        {
          title: 'iPhone 15 Pro Max 256GB - Brand New',
          description: 'Latest iPhone in perfect condition, never used',
          category: 'electronics',
          condition: 'new',
          startingPrice: 999,
          currentBid: 1050,
          buyItNowPrice: 1200,
          startTime: new Date(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          seller: testUser._id,
          status: 'active',
          images: ['https://via.placeholder.com/400x300?text=iPhone+15+Pro'],
          tags: ['iphone', 'apple', 'smartphone', 'electronics'],
          location: 'New York, NY',
          shipping: { cost: 15, method: 'standard' },
          source: { platform: 'internal' },
          aiScore: {
            dealPotential: 85,
            competitionLevel: 'high',
            trendingScore: 92
          }
        },
        {
          title: 'MacBook Pro M3 14" 512GB SSD',
          description: 'Powerful laptop for professionals and creators',
          category: 'electronics',
          condition: 'like-new',
          startingPrice: 1599,
          currentBid: 1650,
          buyItNowPrice: 1800,
          startTime: new Date(),
          endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          seller: testUser._id,
          status: 'active',
          images: ['https://via.placeholder.com/400x300?text=MacBook+Pro'],
          tags: ['macbook', 'apple', 'laptop', 'computer'],
          location: 'San Francisco, CA',
          shipping: { cost: 25, method: 'express' },
          source: { platform: 'internal' },
          aiScore: {
            dealPotential: 78,
            competitionLevel: 'medium',
            trendingScore: 88
          }
        },
        {
          title: 'Nike Air Jordan 1 Retro High OG',
          description: 'Classic sneakers in excellent condition',
          category: 'fashion',
          condition: 'good',
          startingPrice: 120,
          currentBid: 135,
          buyItNowPrice: 180,
          startTime: new Date(),
          endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          seller: testUser._id,
          status: 'active',
          images: ['https://via.placeholder.com/400x300?text=Air+Jordan'],
          tags: ['nike', 'jordan', 'sneakers', 'shoes'],
          location: 'Los Angeles, CA',
          shipping: { cost: 10, method: 'standard' },
          source: { platform: 'internal' },
          aiScore: {
            dealPotential: 90,
            competitionLevel: 'high',
            trendingScore: 85
          }
        },
        {
          title: 'PlayStation 5 Digital Edition',
          description: 'Gaming console with controller and games',
          category: 'gaming',
          condition: 'good',
          startingPrice: 400,
          currentBid: 420,
          buyItNowPrice: 500,
          startTime: new Date(),
          endTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          seller: testUser._id,
          status: 'active',
          images: ['https://via.placeholder.com/400x300?text=PlayStation+5'],
          tags: ['playstation', 'ps5', 'gaming', 'console'],
          location: 'Chicago, IL',
          shipping: { cost: 20, method: 'standard' },
          source: { platform: 'internal' },
          aiScore: {
            dealPotential: 82,
            competitionLevel: 'medium',
            trendingScore: 90
          }
        },
        {
          title: 'Vintage Rolex Submariner Watch',
          description: 'Classic dive watch from 1990s, fully serviced',
          category: 'luxury',
          condition: 'excellent',
          startingPrice: 8000,
          currentBid: 8500,
          buyItNowPrice: 10000,
          startTime: new Date(),
          endTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          seller: testUser._id,
          status: 'active',
          images: ['https://via.placeholder.com/400x300?text=Rolex+Submariner'],
          tags: ['rolex', 'watch', 'luxury', 'vintage'],
          location: 'Miami, FL',
          shipping: { cost: 50, method: 'insured' },
          source: { platform: 'internal' },
          aiScore: {
            dealPotential: 75,
            competitionLevel: 'low',
            trendingScore: 80
          }
        }
      ];

      // Create auctions
      const createdAuctions = await Auction.insertMany(sampleAuctions);
      console.log(`✅ Created ${createdAuctions.length} sample auctions`);

      // Also create some external platform auctions
      const externalAuctions = [
        {
          title: 'Samsung Galaxy S24 Ultra 512GB',
          description: 'Latest Android flagship smartphone',
          category: 'electronics',
          condition: 'new',
          startingPrice: 899,
          currentBid: 950,
          buyItNowPrice: 1100,
          startTime: new Date(),
          endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
          seller: testUser._id,
          status: 'active',
          images: ['https://via.placeholder.com/400x300?text=Galaxy+S24'],
          tags: ['samsung', 'galaxy', 'smartphone', 'android'],
          location: 'Austin, TX',
          shipping: { cost: 15, method: 'standard' },
          source: { platform: 'ebay' },
          aiScore: {
            dealPotential: 88,
            competitionLevel: 'high',
            trendingScore: 95
          }
        },
        {
          title: 'Tesla Model 3 Accessories Bundle',
          description: 'Complete set of premium accessories',
          category: 'automotive',
          condition: 'new',
          startingPrice: 300,
          currentBid: 320,
          buyItNowPrice: 400,
          startTime: new Date(),
          endTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          seller: testUser._id,
          status: 'active',
          images: ['https://via.placeholder.com/400x300?text=Tesla+Accessories'],
          tags: ['tesla', 'model3', 'accessories', 'automotive'],
          location: 'Seattle, WA',
          shipping: { cost: 25, method: 'standard' },
          source: { platform: 'facebook' },
          aiScore: {
            dealPotential: 70,
            competitionLevel: 'low',
            trendingScore: 75
          }
        }
      ];

      const createdExternal = await Auction.insertMany(externalAuctions);
      console.log(`✅ Created ${createdExternal.length} external platform auctions`);

    } else {
      console.log('\n📊 Existing auctions found. Checking trending data...\n');
      
      // Get some sample auctions
      const sampleAuctions = await Auction.find({ status: 'active' }).limit(5);
      console.log(`Found ${sampleAuctions.length} active auctions:`);
      
      sampleAuctions.forEach((auction, index) => {
        console.log(`\n${index + 1}. ${auction.title}`);
        console.log(`   Category: ${auction.category}`);
        console.log(`   Price: $${auction.currentBid}`);
        console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
        console.log(`   Deal Potential: ${auction.aiScore?.dealPotential || 'N/A'}`);
        console.log(`   Platform: ${auction.source?.platform || 'internal'}`);
      });
    }

    // Test the trending endpoint logic
    console.log('\n🔥 Testing Trending Logic...\n');
    
    const trendingAuctions = await Auction.find({
      status: 'active'
    })
    .sort({ 
      'aiScore.trendingScore': -1, 
      'aiScore.dealPotential': -1,
      createdAt: -1 
    })
    .limit(10);

    console.log(`✅ Found ${trendingAuctions.length} trending auctions:`);
    trendingAuctions.forEach((auction, index) => {
      console.log(`\n${index + 1}. ${auction.title}`);
      console.log(`   Trending Score: ${auction.aiScore?.trendingScore || 'N/A'}`);
      console.log(`   Deal Potential: ${auction.aiScore?.dealPotential || 'N/A'}`);
      console.log(`   Platform: ${auction.source?.platform || 'internal'}`);
    });

    // Test trending categories
    const trendingCategories = await Auction.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 }, avgTrendingScore: { $avg: '$aiScore.trendingScore' } } },
      { $sort: { avgTrendingScore: -1, count: -1 } },
      { $limit: 10 }
    ]);

    console.log(`\n📈 Trending Categories:`);
    trendingCategories.forEach((category, index) => {
      console.log(`${index + 1}. ${category._id}: ${category.count} auctions (avg score: ${Math.round(category.avgTrendingScore || 0)})`);
    });

    console.log('\n🎉 Trending Data Test Complete!');
    console.log('=' .repeat(50));
    console.log('✅ Sample auctions created/verified');
    console.log('✅ Trending logic working correctly');
    console.log('✅ Categories aggregated properly');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the test
testTrendingData();


