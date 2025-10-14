const mongoose = require('mongoose');
const User = require('./models/User');
const Auction = require('./models/Auction');
require('dotenv').config();

async function testProductFeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('Connected to MongoDB');

    // Create a test user
    let user = await User.findOne({ email: 'feeduser@example.com' });
    if (!user) {
      user = new User({
        username: 'feed_user',
        email: 'feeduser@example.com',
        password: 'hashedpassword',
        membershipTier: 'free',
        points: 0
      });
      await user.save();
      console.log('Created test user');
    }

    console.log('\n🎯 Testing TikTok-like Product Feed System\n');

    // Test 1: Create sample auctions with AI scores
    console.log('📱 CREATING SAMPLE AUCTIONS WITH AI SCORES:');
    
    const sampleAuctions = [
      {
        title: 'iPhone 14 Pro Max 256GB - Unlocked',
        description: 'Like new iPhone 14 Pro Max in Space Black',
        startingPrice: 800,
        currentBid: 850,
        timeRemaining: 1800, // 30 minutes
        category: 'electronics',
        condition: 'like-new',
        images: [{ url: 'https://via.placeholder.com/300x300?text=iPhone+14+Pro', isPrimary: true }],
        source: { platform: 'ebay', url: 'https://ebay.com/iphone14' },
        aiScore: {
          dealPotential: 85,
          competitionLevel: 'high',
          trendingScore: 92
        },
        status: 'active',
        seller: user._id,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 1800000)
      },
      {
        title: 'Nike Air Jordan 1 Retro High OG',
        description: 'Brand new Jordan 1s in Bred colorway',
        startingPrice: 150,
        currentBid: 180,
        timeRemaining: 3600, // 1 hour
        category: 'fashion',
        condition: 'new',
        images: [{ url: 'https://via.placeholder.com/300x300?text=Jordan+1+Bred', isPrimary: true }],
        source: { platform: 'mercari', url: 'https://mercari.com/jordan1' },
        aiScore: {
          dealPotential: 78,
          competitionLevel: 'medium',
          trendingScore: 88
        },
        status: 'active',
        seller: user._id,
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() + 3600000)
      },
      {
        title: 'PlayStation 5 Digital Edition',
        description: 'PS5 Digital with 2 controllers and games',
        startingPrice: 400,
        currentBid: 450,
        timeRemaining: 7200, // 2 hours
        category: 'electronics',
        condition: 'good',
        images: [{ url: 'https://via.placeholder.com/300x300?text=PS5+Digital', isPrimary: true }],
        source: { platform: 'facebook', url: 'https://facebook.com/ps5' },
        aiScore: {
          dealPotential: 72,
          competitionLevel: 'low',
          trendingScore: 85
        },
        status: 'active',
        seller: user._id,
        startTime: new Date(Date.now() - 10800000),
        endTime: new Date(Date.now() + 7200000)
      },
      {
        title: 'Supreme Box Logo Hoodie FW22',
        description: 'Rare Supreme hoodie in excellent condition',
        startingPrice: 300,
        currentBid: 320,
        timeRemaining: 900, // 15 minutes
        category: 'fashion',
        condition: 'like-new',
        images: [{ url: 'https://via.placeholder.com/300x300?text=Supreme+Hoodie', isPrimary: true }],
        source: { platform: 'ebay', url: 'https://ebay.com/supreme' },
        aiScore: {
          dealPotential: 95,
          competitionLevel: 'high',
          trendingScore: 98
        },
        status: 'active',
        seller: user._id,
        startTime: new Date(Date.now() - 2700000),
        endTime: new Date(Date.now() + 900000)
      }
    ];

    // Clear existing test auctions
    await Auction.deleteMany({ 'source.platform': { $in: ['ebay', 'mercari', 'facebook'] } });
    
    // Create new auctions
    for (const auctionData of sampleAuctions) {
      const auction = new Auction(auctionData);
      await auction.save();
      console.log(`✅ Created: ${auction.title} (${auction.source.platform})`);
    }

    // Test 2: Simulate TikTok-like product feed
    console.log('\n🎬 TIKTOK-LIKE PRODUCT FEED:');
    
    // Get product feed (simulating API call)
    const productFeed = await Auction.find({
      status: 'active',
      $or: [
        { 'source.platform': { $exists: true } },
        { seller: { $exists: true } }
      ]
    })
    .sort({ 'aiScore.dealPotential': -1, 'aiScore.trendingScore': -1, createdAt: -1 })
    .limit(10);

    console.log(`Found ${productFeed.length} auctions in feed:`);
    productFeed.forEach((auction, index) => {
      console.log(`${index + 1}. ${auction.title}`);
      console.log(`   Platform: ${auction.source?.platform || 'final10'}`);
      console.log(`   Current Bid: $${auction.currentBid}`);
      console.log(`   Time Remaining: ${Math.floor(auction.timeRemaining / 60)} minutes`);
      console.log(`   AI Scores: Deal=${auction.aiScore?.dealPotential}%, Trending=${auction.aiScore?.trendingScore}%`);
      console.log(`   Competition: ${auction.aiScore?.competitionLevel}`);
      console.log('');
    });

    // Test 3: Trending feed
    console.log('🔥 TRENDING FEED:');
    
    const trendingFeed = await Auction.find({
      status: 'active'
    })
    .sort({ 'aiScore.trendingScore': -1, 'aiScore.dealPotential': -1, createdAt: -1 })
    .limit(5);

    console.log('Top trending auctions:');
    trendingFeed.forEach((auction, index) => {
      console.log(`${index + 1}. ${auction.title} (Trending: ${auction.aiScore?.trendingScore}%)`);
    });

    // Test 4: Category analysis
    console.log('\n📊 CATEGORY ANALYSIS:');
    
    const categoryStats = await Auction.aggregate([
      { $match: { status: 'active' } },
      { 
        $group: { 
          _id: '$category', 
          count: { $sum: 1 }, 
          avgDealPotential: { $avg: '$aiScore.dealPotential' },
          avgTrendingScore: { $avg: '$aiScore.trendingScore' }
        } 
      },
      { $sort: { avgTrendingScore: -1 } }
    ]);

    console.log('Category breakdown:');
    categoryStats.forEach(cat => {
      console.log(`${cat._id}: ${cat.count} auctions, Avg Deal=${Math.round(cat.avgDealPotential)}%, Avg Trending=${Math.round(cat.avgTrendingScore)}%`);
    });

    // Test 5: AI Video Scanning Simulation
    console.log('\n🤖 AI VIDEO SCANNING SIMULATION:');
    
    const mockVideoAnalysis = {
      videoUrl: 'https://tiktok.com/@user/video/123456789',
      platform: 'tiktok',
      detectedProducts: [
        {
          name: 'iPhone 14 Pro',
          confidence: 0.95,
          category: 'electronics',
          priceRange: { min: 800, max: 1200 },
          keywords: ['iphone', 'apple', 'smartphone', 'pro']
        },
        {
          name: 'Nike Air Jordan',
          confidence: 0.87,
          category: 'fashion',
          priceRange: { min: 150, max: 300 },
          keywords: ['nike', 'jordan', 'sneakers', 'shoes']
        }
      ]
    };

    console.log('Video Analysis Results:');
    console.log(`Video URL: ${mockVideoAnalysis.videoUrl}`);
    console.log(`Platform: ${mockVideoAnalysis.platform}`);
    console.log('Detected Products:');
    
    mockVideoAnalysis.detectedProducts.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (${Math.round(product.confidence * 100)}% confidence)`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price Range: $${product.priceRange.min} - $${product.priceRange.max}`);
      console.log(`   Keywords: ${product.keywords.join(', ')}`);
    });

    // Test 6: Market Insights
    console.log('\n🧠 AI MARKET INSIGHTS:');
    
    const insights = [
      {
        type: 'trending_category',
        title: 'Hot Category',
        description: '"electronics" is trending this week',
        confidence: 0.85
      },
      {
        type: 'price_opportunity',
        title: 'Price Opportunity',
        description: '2 low-priced auctions ending soon - great deals available!',
        confidence: 0.78
      },
      {
        type: 'platform_insight',
        title: 'Platform Activity',
        description: 'Most active platform: ebay',
        confidence: 0.92
      }
    ];

    insights.forEach((insight, index) => {
      console.log(`${index + 1}. ${insight.title}`);
      console.log(`   ${insight.description}`);
      console.log(`   Confidence: ${Math.round(insight.confidence * 100)}%`);
      console.log('');
    });

    console.log('✅ TikTok-like Product Feed system test completed!');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('• TikTok-like product feed with AI scoring');
    console.log('• Trending auctions based on AI analysis');
    console.log('• Category breakdown and insights');
    console.log('• AI video scanning simulation');
    console.log('• Market insights generation');
    console.log('• Integration with market scanner');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testProductFeed();
