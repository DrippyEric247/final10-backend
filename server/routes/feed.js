const express = require('express');
const router = express.Router();
const FeedItem = require('../models/feeditem');
const { ingestYouTube } = require('../services/youtube');
const { ingestReddit } = require('../services/reddit');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Auction = require('../models/Auction');
const marketScanner = require('../services/marketScanner');
const AuctionAggregator = require('../services/AuctionAggregator');

// GET /api/feed?source=all&limit=20&cursor=<iso>&tags=StaySavvy,StayEarning
router.get('/', async (req, res) => {
  const { source = 'all', limit = 20, cursor, tags } = req.query;

  const q = { isProduct: true };
  if (source !== 'all') q.source = source;
  if (tags) {
    const list = String(tags).split(',').map(s => s.trim().toLowerCase());
    q.tags = { $in: list.map(t => new RegExp(t, 'i')) };
  }
  if (cursor) q.timestamp = { $lt: new Date(cursor) };

  const items = await FeedItem.find(q)
    .sort({ timestamp: -1, rank: -1, _id: -1 })
    .limit(Math.min(Number(limit), 50));

  res.json({
    items,
    nextCursor: items.length ? items[items.length - 1].timestamp : null
  });
});

// POST /api/feed/ingest (manual trigger for now)
router.post('/ingest', async (req, res) => {
  await ingestYouTube({});
  await ingestReddit({});
  res.json({ ok: true });
});

// POST /api/feed/submit  (user submits external post to earn bonus)
router.post('/submit', auth, async (req, res) => {
  const { url, caption } = req.body || {};
  if (!url) return res.status(400).json({ message: 'Missing url' });

  // naive verify for required hashtags
  const cap = (caption || '').toLowerCase();
  const hasAllTags = ['#final10','#stayearning','#staysavvy'].every(tag => cap.includes(tag));
  if (!hasAllTags) return res.status(400).json({ message: 'Missing required hashtags' });

  // TODO: optionally fetch oEmbed for TikTok/IG/YT here and store embedHtml (keep the URL only)
  // For now, reward immediately
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.points = (user.points || 0) + 100; // bonus for posting a win
  user.history = user.history || [];
  user.history.unshift({ type: 'bonus', amount: 100, note: `Social post: ${url}` });
  await user.save();

  return res.json({ message: 'Verified post. +100 Savvy Points added!', newBalance: user.points });
});

// GET /api/feed/product-feed - TikTok-like product feed with AI scanning
router.get('/product-feed', auth, async (req, res) => {
  try {
    const { limit = 20, cursor, category, trending = false } = req.query;
    
    // Build query for product feed
    let query = { 
      status: 'active',
      $or: [
        { 'source.platform': { $exists: true } }, // External auctions
        { seller: { $exists: true } } // Internal auctions
      ]
    };
    
    if (category && category !== 'all') {
      query.category = category;
    }
    
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }
    
    // Sort by trending score if requested, otherwise by AI score and time
    let sort = { createdAt: -1 };
    if (trending === 'true') {
      sort = { 'aiScore.trendingScore': -1, 'aiScore.dealPotential': -1, createdAt: -1 };
    } else {
      sort = { 'aiScore.dealPotential': -1, 'aiScore.trendingScore': -1, createdAt: -1 };
    }
    
    const auctions = await Auction.find(query)
      .populate('seller', 'username profileImage')
      .sort(sort)
      .limit(parseInt(limit));
    
    // Format for TikTok-like feed
    const feedItems = auctions.map(auction => ({
      id: auction._id,
      type: 'auction',
      title: auction.title,
      description: auction.description,
      currentBid: auction.currentBid,
      timeRemaining: auction.timeRemaining,
      images: auction.images,
      category: auction.category,
      condition: auction.condition,
      platform: auction.source?.platform || 'final10',
      seller: auction.seller,
      aiScore: auction.aiScore,
      dealPotential: auction.aiScore?.dealPotential || 50,
      competitionLevel: auction.aiScore?.competitionLevel || 'medium',
      trendingScore: auction.aiScore?.trendingScore || 30,
      createdAt: auction.createdAt,
      endTime: auction.endTime,
      source: auction.source
    }));
    
    res.json({
      items: feedItems,
      nextCursor: feedItems.length ? feedItems[feedItems.length - 1].createdAt : null,
      total: feedItems.length
    });
  } catch (error) {
    console.error('Product feed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/feed/scan-video - AI video scanning for products
router.post('/scan-video', auth, async (req, res) => {
  try {
    const { videoUrl, platform = 'tiktok' } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ message: 'Video URL is required' });
    }
    
    // AI video analysis (mock implementation)
    const detectedProducts = await analyzeVideoForProducts(videoUrl, platform);
    
    // Search for detected products across platforms
    const auctionAggregator = new AuctionAggregator();
    const searchResults = [];
    
    for (const product of detectedProducts) {
      const results = await auctionAggregator.getOneFromEach(product.name);
      searchResults.push({
        detectedProduct: product,
        auctions: results
      });
    }
    
    res.json({
      message: 'Video analyzed successfully',
      detectedProducts,
      searchResults,
      totalAuctions: searchResults.reduce((sum, result) => sum + result.auctions.length, 0)
    });
  } catch (error) {
    console.error('Video scanning error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/feed/trending - Trending products and auctions
router.get('/trending', auth, async (req, res) => {
  try {
    const { limit = 20, timeRange = '24h' } = req.query;
    
    let timeFilter = {};
    if (timeRange === '24h') {
      timeFilter = { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } };
    } else if (timeRange === '7d') {
      timeFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
    }
    
    // Get trending auctions based on AI scores and engagement
    const trendingAuctions = await Auction.find({
      status: 'active',
      ...timeFilter
    })
    .sort({ 
      'aiScore.trendingScore': -1, 
      'aiScore.dealPotential': -1,
      createdAt: -1 
    })
    .limit(parseInt(limit))
    .populate('seller', 'username profileImage');
    
    // Get trending categories
    const trendingCategories = await Auction.aggregate([
      { $match: { status: 'active', ...timeFilter } },
      { $group: { _id: '$category', count: { $sum: 1 }, avgTrendingScore: { $avg: '$aiScore.trendingScore' } } },
      { $sort: { avgTrendingScore: -1, count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      trendingAuctions,
      trendingCategories,
      timeRange
    });
  } catch (error) {
    console.error('Trending feed error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/feed/ai-insights - AI-powered market insights
router.get('/ai-insights', auth, async (req, res) => {
  try {
    const insights = await generateMarketInsights();
    
    res.json({
      insights,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/feed/refresh-scanner - Manually refresh market scanner
router.post('/refresh-scanner', auth, async (req, res) => {
  try {
    // Check if user has permission (admin or premium)
    const user = await User.findById(req.user.id);
    if (!user || (user.membershipTier !== 'premium' && user.membershipTier !== 'pro')) {
      return res.status(403).json({ message: 'Premium subscription required' });
    }
    
    // Trigger market scanner refresh
    await marketScanner.scanAllPlatforms();
    
    res.json({
      message: 'Market scanner refreshed successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Scanner refresh error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to analyze video for products (mock AI implementation)
async function analyzeVideoForProducts(videoUrl, platform) {
  // This would integrate with actual AI services like:
  // - Google Vision API for image recognition
  // - AWS Rekognition for video analysis
  // - Custom ML models for product detection
  
  // Mock implementation for demonstration
  const mockProducts = [
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
      category: 'shoes',
      priceRange: { min: 150, max: 300 },
      keywords: ['nike', 'jordan', 'sneakers', 'shoes']
    },
    {
      name: 'PlayStation 5',
      confidence: 0.92,
      category: 'gaming',
      priceRange: { min: 400, max: 600 },
      keywords: ['playstation', 'ps5', 'gaming', 'console']
    }
  ];
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockProducts;
}

// Helper function to generate market insights
async function generateMarketInsights() {
  try {
    // Get recent auction data for analysis
    const recentAuctions = await Auction.find({
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    // Analyze trends
    const categoryTrends = {};
    const platformTrends = {};
    const priceTrends = { low: 0, medium: 0, high: 0 };
    
    recentAuctions.forEach(auction => {
      // Category trends
      categoryTrends[auction.category] = (categoryTrends[auction.category] || 0) + 1;
      
      // Platform trends
      const platform = auction.source?.platform || 'final10';
      platformTrends[platform] = (platformTrends[platform] || 0) + 1;
      
      // Price trends
      if (auction.currentBid < 50) priceTrends.low++;
      else if (auction.currentBid < 200) priceTrends.medium++;
      else priceTrends.high++;
    });
    
    // Generate insights
    const insights = [
      {
        type: 'trending_category',
        title: 'Hot Category',
        description: `"${Object.keys(categoryTrends).reduce((a, b) => categoryTrends[a] > categoryTrends[b] ? a : b)}" is trending this week`,
        confidence: 0.85
      },
      {
        type: 'price_opportunity',
        title: 'Price Opportunity',
        description: `${priceTrends.low} low-priced auctions ending soon - great deals available!`,
        confidence: 0.78
      },
      {
        type: 'platform_insight',
        title: 'Platform Activity',
        description: `Most active platform: ${Object.keys(platformTrends).reduce((a, b) => platformTrends[a] > platformTrends[b] ? a : b)}`,
        confidence: 0.92
      }
    ];
    
    return insights;
  } catch (error) {
    console.error('Error generating insights:', error);
    return [];
  }
}

module.exports = router;

