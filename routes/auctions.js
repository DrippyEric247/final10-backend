const express = require('express');
const Auction = require('../models/Auction');
const User = require('../models/User');
const SavvyPoint = require('../models/SavvyPoint');
const auth = require('../middleware/auth');
const { searchRateLimit, incrementSearchCount } = require('../middleware/searchRateLimit');
const AuctionAggregator = require('../services/AuctionAggregator');

const router = express.Router();
const auctionAggregator = new AuctionAggregator();

// Function to verify share URLs
async function verifyShareUrl(url, platform, type, productTitle = null) {
  try {
    // Basic URL validation
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Check if URL is from a valid platform
    const validPlatforms = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'];
    const platformLower = platform.toLowerCase();
    
    if (!validPlatforms.includes(platformLower)) {
      return false;
    }

    // Check if URL contains the platform domain
    const platformDomains = {
      twitter: ['twitter.com', 'x.com', 't.co'],
      facebook: ['facebook.com', 'fb.com'],
      instagram: ['instagram.com'],
      linkedin: ['linkedin.com'],
      tiktok: ['tiktok.com'],
      youtube: ['youtube.com', 'youtu.be']
    };

    const domains = platformDomains[platformLower] || [];
    const hasValidDomain = domains.some(domain => url.includes(domain));
    
    if (!hasValidDomain) {
      return false;
    }

    // For social media posts, check for required hashtags
    if (type === 'social') {
      // In a real implementation, you would fetch the post content and check for hashtags
      // For now, we'll do basic validation
      const requiredHashtags = ['#StayEarning', '#StaySavvy'];
      const urlLower = url.toLowerCase();
      
      // Check if URL contains hashtag indicators (this is a simplified check)
      // In reality, you'd need to fetch the actual post content
      return urlLower.includes('hashtag') || urlLower.includes('#') || urlLower.includes('stayearning') || urlLower.includes('staysavvy');
    }

    // For app/product sharing, check if URL looks like a share link
    if (type === 'app' || type === 'product') {
      // Check if URL contains share-related parameters
      const shareIndicators = ['share', 'post', 'status', 'tweet', 'story', 'reel'];
      const urlLower = url.toLowerCase();
      
      return shareIndicators.some(indicator => urlLower.includes(indicator));
    }

    return true;
  } catch (error) {
    console.error('Error verifying share URL:', error);
    return false;
  }
}

// Live search across all platforms - returns one result from each
router.get('/live-search', auth, searchRateLimit, async (req, res) => {
  try {
    const { q: searchTerm } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    console.log(`🔍 Live search for: ${searchTerm}`);
    
    // Get one result from each platform
    const liveResults = await auctionAggregator.getOneFromEach(searchTerm);
    
    // Also save to database for future reference
    await auctionAggregator.saveToDatabase(liveResults);
    
    // Increment search count for free users
    await req.user.incrementSearchCount();
    
    // Award points for search task
    await req.user.completeSearchTask();
    
    res.json({
      searchTerm,
      results: liveResults,
      totalFound: liveResults.length,
      platforms: {
        ebay: liveResults.filter(r => r.source.platform === 'ebay').length,
        mercari: liveResults.filter(r => r.source.platform === 'mercari').length,
        facebook: liveResults.filter(r => r.source.platform === 'facebook').length
      },
      searchStatus: req.searchStatus,
      userTier: req.user.membershipTier,
      taskPointsEarned: 25 // Search task points
    });
  } catch (error) {
    console.error('Live search error:', error);
    res.status(500).json({ message: 'Server error during live search' });
  }
});

// Get all auctions with filters
router.get('/', async (req, res) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      condition,
      platform,
      timeRemaining,
      sortBy = 'endTime',
      sortOrder = 'asc',
      page = 1,
      limit = 20,
      search
    } = req.query;

    const filter = { status: 'active' };

    // Apply filters
    if (category) filter.category = category;
    if (condition) filter.condition = condition;
    if (platform) filter['source.platform'] = platform;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.currentBid = {};
      if (minPrice) filter.currentBid.$gte = parseFloat(minPrice);
      if (maxPrice) filter.currentBid.$lte = parseFloat(maxPrice);
    }

    // Time remaining filter
    if (timeRemaining) {
      const minutes = parseInt(timeRemaining);
      const seconds = minutes * 60;
      filter.timeRemaining = { $lte: seconds };
    }

    // Sort options
    const sortOptions = {};
    if (sortBy === 'endTime') {
      sortOptions.endTime = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'price') {
      sortOptions.currentBid = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'dealPotential') {
      sortOptions['aiScore.dealPotential'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'trending') {
      sortOptions['aiScore.trendingScore'] = sortOrder === 'asc' ? 1 : -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const auctions = await Auction.find(filter)
      .populate('seller', 'username profileImage')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Auction.countDocuments(filter);

    res.json({
      auctions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get daily tasks status
router.get('/daily-tasks', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const dailyTasks = user.getDailyTasks();
    
    res.json({
      userTier: user.membershipTier,
      totalPoints: user.points,
      dailyTasks,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Next day
    });
  } catch (error) {
    console.error('Get daily tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single auction
router.get('/:id', async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('seller', 'username profileImage')
      .populate('bids.bidder', 'username profileImage')
      .populate('winner', 'username profileImage');

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Increment view count
    auction.views += 1;
    await auction.save();

    res.json({ auction });
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Place a bid
router.post('/:id/bid', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    if (auction.status !== 'active') {
      return res.status(400).json({ message: 'Auction is not active' });
    }

    if (auction.timeRemaining <= 0) {
      return res.status(400).json({ message: 'Auction has ended' });
    }

    if (amount <= auction.currentBid) {
      return res.status(400).json({ message: 'Bid must be higher than current bid' });
    }

    // Check if user has sufficient points for bidding (premium feature)
    const user = await User.findById(req.user.id);
    if (user.membershipTier === 'free' && user.savvyPoints < 10) {
      return res.status(400).json({ 
        message: 'Insufficient Savvy Points. You need at least 10 points to place a bid.' 
      });
    }

    // Create new bid
    const bid = {
      bidder: req.user.id,
      amount: amount,
      timestamp: new Date(),
      isWinning: true
    };

    // Mark previous winning bid as not winning
    auction.bids.forEach(b => b.isWinning = false);

    auction.bids.push(bid);
    auction.currentBid = amount;
    auction.bidCount = auction.bids.length;

    // Add user to watchers if not already there
    if (!auction.watchers.includes(req.user.id)) {
      auction.watchers.push(req.user.id);
    }

    await auction.save();

    // Award points for bidding
    await SavvyPoint.awardPoints(
      req.user.id,
      5,
      'bid',
      `Bid placed on "${auction.title}"`,
      auction._id,
      'Auction',
      1
    );

    // Deduct points for free users
    if (user.membershipTier === 'free') {
      await SavvyPoint.redeemPoints(
        req.user.id,
        10,
        'Bid placement fee'
      );
    }

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`auction-${auction._id}`).emit('bid-update', {
      auctionId: auction._id,
      currentBid: auction.currentBid,
      bidCount: auction.bidCount,
      latestBid: bid
    });

    res.json({ 
      message: 'Bid placed successfully',
      bid,
      auction: {
        currentBid: auction.currentBid,
        bidCount: auction.bidCount
      }
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Watch/unwatch auction
router.post('/:id/watch', auth, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const isWatching = auction.watchers.includes(req.user.id);

    if (isWatching) {
      auction.watchers = auction.watchers.filter(
        watcherId => watcherId.toString() !== req.user.id.toString()
      );
    } else {
      auction.watchers.push(req.user.id);
    }

    await auction.save();

    res.json({ 
      message: isWatching ? 'Auction unwatched' : 'Auction watched',
      isWatching: !isWatching
    });
  } catch (error) {
    console.error('Watch auction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get trending auctions
router.get('/trending/auctions', async (req, res) => {
  try {
    const auctions = await Auction.find({
      status: 'active',
      'aiScore.trendingScore': { $gte: 70 },
      timeRemaining: { $lte: 600 } // 10 minutes or less
    })
    .populate('seller', 'username profileImage')
    .sort({ 'aiScore.trendingScore': -1, 'aiScore.dealPotential': -1 })
    .limit(10);

    res.json({ auctions });
  } catch (error) {
    console.error('Get trending auctions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ending soon auctions
router.get('/ending-soon/auctions', async (req, res) => {
  try {
    const auctions = await Auction.find({
      status: 'active',
      timeRemaining: { $lte: 600, $gt: 0 } // 10 minutes or less, but not ended
    })
    .populate('seller', 'username profileImage')
    .sort({ timeRemaining: 1 })
    .limit(20);

    res.json({ auctions });
  } catch (error) {
    console.error('Get ending soon auctions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get high deal potential auctions
router.get('/deals/auctions', async (req, res) => {
  try {
    const auctions = await Auction.find({
      status: 'active',
      'aiScore.dealPotential': { $gte: 80 },
      'aiScore.competitionLevel': 'low'
    })
    .populate('seller', 'username profileImage')
    .sort({ 'aiScore.dealPotential': -1 })
    .limit(15);

    res.json({ auctions });
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's search status and limits
router.get('/search-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const searchStatus = user.canSearch();
    
    res.json({
      userTier: user.membershipTier,
      searchStatus,
      subscriptionActive: user.isSubscriptionActive(),
      subscriptionExpires: user.subscriptionExpires,
      benefits: {
        free: {
          dailySearches: 5,
          features: ['Basic search', 'Limited results']
        },
        premium: {
          dailySearches: 'unlimited',
          features: ['Unlimited searches', 'Priority support', 'Advanced filters']
        },
        pro: {
          dailySearches: 'unlimited',
          features: ['Unlimited searches', 'Priority support', 'Advanced filters', 'API access']
        }
      }
    });
  } catch (error) {
    console.error('Get search status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get ad-watching status
router.get('/ad-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const adStatus = user.canWatchAd();
    const searchStatus = user.canSearch();
    
    res.json({
      userTier: user.membershipTier,
      adStatus,
      searchStatus,
      benefits: {
        searchesPerAd: user.adWatching.searchesPerAd,
        maxAdsPerDay: user.adWatching.maxAdsPerDay,
        totalPossibleSearches: user.dailySearchLimit + (user.adWatching.maxAdsPerDay * user.adWatching.searchesPerAd)
      }
    });
  } catch (error) {
    console.error('Get ad status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Complete ad watch and earn searches
router.post('/watch-ad', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user can watch ads (allow premium users for daily tasks)
    const adStatus = user.canWatchAd();
    if (!adStatus.canWatch && user.membershipTier === 'free') {
      return res.status(400).json({
        message: 'Cannot watch more ads today',
        error: 'AD_LIMIT_REACHED',
        details: adStatus
      });
    }

    // Record ad completion
    await user.completeAdWatch();
    
    // Track ad for daily task
    await user.trackAdForTask();
    
    // Get updated search status
    const searchStatus = user.canSearch();
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: `Ad watched! You earned ${user.adWatching.searchesPerAd} more searches!`,
      adStatus: user.canWatchAd(),
      searchStatus,
      earnedSearches: user.adWatching.searchesPerAd,
      totalSearchesNow: searchStatus.limit,
      dailyTasks,
      taskProgress: {
        adsWatched: dailyTasks.tasks.watchAds.progress,
        target: dailyTasks.tasks.watchAds.target,
        completed: dailyTasks.tasks.watchAds.completed
      }
    });
  } catch (error) {
    console.error('Watch ad error:', error);
    if (error.message === 'Daily ad limit reached') {
      return res.status(400).json({
        message: 'Daily ad limit reached',
        error: 'AD_LIMIT_REACHED'
      });
    }
    if (error.message === 'Premium users cannot watch ads') {
      return res.status(400).json({
        message: 'Premium users have unlimited searches',
        error: 'PREMIUM_USER'
      });
    }
    res.status(500).json({ message: 'Server error during ad watch' });
  }
});

// Claim daily login points
router.post('/claim-daily-login', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const beforePoints = user.points;
    await user.completeDailyLogin();
    const afterPoints = user.points;
    const pointsEarned = afterPoints - beforePoints;
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: pointsEarned > 0 ? `Daily login claimed! +${pointsEarned} points` : 'Daily login already claimed today',
      pointsEarned,
      totalPoints: user.points,
      dailyTasks
    });
  } catch (error) {
    console.error('Claim daily login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Watch ad for daily task
router.post('/watch-ad', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const beforePoints = user.points;
    await user.trackAdForTask();
    const afterPoints = user.points;
    const pointsEarned = afterPoints - beforePoints;
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: pointsEarned > 0 ? `Ad watched! +${pointsEarned} points` : 'Ad watched! Keep watching to earn points',
      pointsEarned,
      totalPoints: user.points,
      dailyTasks,
      adsWatched: user.dailyTasks.completed.watchAds
    });
  } catch (error) {
    console.error('Watch ad error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track app sharing - requires verification
router.post('/track-app-share', auth, async (req, res) => {
  try {
    const { shareUrl, platform } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate required fields
    if (!shareUrl || !platform) {
      return res.status(400).json({ 
        message: 'Share URL and platform are required for verification' 
      });
    }

    // Verify the share URL contains required elements
    const isValidShare = await verifyShareUrl(shareUrl, platform, 'app');
    if (!isValidShare) {
      return res.status(400).json({ 
        message: 'Invalid share URL. Please provide a valid share link with required hashtags.' 
      });
    }

    const beforePoints = user.points;
    await user.trackAppShare();
    const afterPoints = user.points;
    const pointsEarned = afterPoints - beforePoints;
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: pointsEarned > 0 ? `App shared and verified! +${pointsEarned} points` : 'App sharing limit reached for today',
      pointsEarned,
      totalPoints: user.points,
      dailyTasks,
      verifiedShare: { url: shareUrl, platform }
    });
  } catch (error) {
    console.error('Track app share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track product sharing - requires verification
router.post('/track-product-share', auth, async (req, res) => {
  try {
    const { productId, productTitle, shareUrl, platform } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate required fields
    if (!productId || !productTitle || !shareUrl || !platform) {
      return res.status(400).json({ 
        message: 'Product ID, title, share URL, and platform are required for verification' 
      });
    }

    // Verify the share URL contains required elements
    const isValidShare = await verifyShareUrl(shareUrl, platform, 'product', productTitle);
    if (!isValidShare) {
      return res.status(400).json({ 
        message: 'Invalid share URL. Please provide a valid share link with the product information.' 
      });
    }

    const beforePoints = user.points;
    await user.trackProductShare();
    const afterPoints = user.points;
    const pointsEarned = afterPoints - beforePoints;
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: pointsEarned > 0 ? `Product shared and verified! +${pointsEarned} points` : 'Product sharing already completed today',
      pointsEarned,
      totalPoints: user.points,
      dailyTasks,
      verifiedShare: { url: shareUrl, platform },
      sharedProduct: { id: productId, title: productTitle }
    });
  } catch (error) {
    console.error('Track product share error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Complete social media post task - requires verification
router.post('/complete-social-post', auth, async (req, res) => {
  try {
    const { platform, postUrl } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate required fields
    if (!platform || !postUrl) {
      return res.status(400).json({ 
        message: 'Platform and post URL are required for verification' 
      });
    }

    // Verify the post URL contains required hashtags
    const isValidPost = await verifyShareUrl(postUrl, platform, 'social');
    if (!isValidPost) {
      return res.status(400).json({ 
        message: 'Invalid post URL. Please provide a valid post link with required hashtags #StayEarning #StaySavvy.' 
      });
    }

    const beforePoints = user.points;
    await user.completeSocialPost();
    const afterPoints = user.points;
    const pointsEarned = afterPoints - beforePoints;
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: pointsEarned > 0 ? `Social post verified and completed! +${pointsEarned} points` : 'Social post already completed today',
      pointsEarned,
      totalPoints: user.points,
      dailyTasks,
      verifiedPost: { platform, url: postUrl }
    });
  } catch (error) {
    console.error('Complete social post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upgrade user to premium (mock implementation)
router.post('/upgrade-premium', auth, async (req, res) => {
  try {
    const { durationMonths = 1 } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // In a real app, you'd process payment here
    // For now, we'll just upgrade them
    await user.upgradeToPremium(durationMonths);
    
    res.json({
      message: 'Successfully upgraded to Premium!',
      userTier: user.membershipTier,
      subscriptionExpires: user.subscriptionExpires,
      benefits: 'You now have unlimited searches!'
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ message: 'Server error during upgrade' });
  }
});

// Refresh auction data from all platforms
router.post('/refresh', auth, async (req, res) => {
  try {
    console.log('🔄 Manual refresh requested');
    
    const totalRefreshed = await auctionAggregator.refreshAuctionData();
    
    res.json({
      message: 'Auction data refreshed successfully',
      totalRefreshed,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Server error during refresh' });
  }
});

// Create new auction (for internal sellers)
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      condition,
      startingPrice,
      buyItNowPrice,
      reservePrice,
      endTime,
      images,
      tags,
      location,
      shipping
    } = req.body;

    const auction = new Auction({
      title,
      description,
      category,
      condition,
      startingPrice,
      currentBid: startingPrice,
      buyItNowPrice,
      reservePrice,
      startTime: new Date(),
      endTime: new Date(endTime),
      seller: req.user.id,
      images: images || [],
      tags: tags || [],
      location,
      shipping,
      source: {
        platform: 'internal'
      },
      aiScore: {
        dealPotential: 50,
        competitionLevel: 'medium',
        trendingScore: 30
      }
    });

    await auction.save();

    // Award points for creating auction
    await SavvyPoint.awardPoints(
      req.user.id,
      20,
      'auction_creation',
      `Created auction "${title}"`,
      auction._id,
      'Auction',
      1
    );

    res.status(201).json({ 
      message: 'Auction created successfully',
      auction 
    });
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track video scanner usage for daily task
router.post('/track-video-scanner', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const beforePoints = user.points;
    await user.completeVideoScannerTask();
    const afterPoints = user.points;
    const pointsEarned = afterPoints - beforePoints;
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: pointsEarned > 0 ? `Video scanner used! +${pointsEarned} points` : 'Video scanner task already completed today',
      pointsEarned,
      totalPoints: user.points,
      dailyTasks,
      taskCompleted: user.dailyTasks.completed.useVideoScanner
    });
  } catch (error) {
    console.error('Track video scanner error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Track local deals search for daily task
router.post('/track-local-deals-search', auth, async (req, res) => {
  try {
    const { searchTerm } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const beforePoints = user.points;
    await user.completeLocalDealsTask();
    const afterPoints = user.points;
    const pointsEarned = afterPoints - beforePoints;
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: pointsEarned > 0 ? `Local deals searched! +${pointsEarned} points` : 'Local deals search task already completed today',
      pointsEarned,
      totalPoints: user.points,
      dailyTasks,
      taskCompleted: user.dailyTasks.completed.searchLocalDeals,
      searchTerm: searchTerm || 'local deals'
    });
  } catch (error) {
    console.error('Track local deals search error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
































