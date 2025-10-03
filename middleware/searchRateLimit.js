const User = require('../models/User');

// Rate limiting middleware for search requests
const searchRateLimit = async (req, res, next) => {
  try {
    // Skip rate limiting if no user is authenticated
    if (!req.userId) {
      return next();
    }

    // Get user from database
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Check if user can perform a search
    const searchStatus = user.canSearch();
    
    if (!searchStatus.canSearch) {
      const adStatus = user.canWatchAd();
      return res.status(429).json({
        message: 'Daily search limit reached',
        error: 'RATE_LIMIT_EXCEEDED',
        details: {
          tier: user.membershipTier,
          limit: searchStatus.limit,
          used: searchStatus.used,
          remaining: searchStatus.remaining,
          baseLimit: searchStatus.baseLimit,
          adEarned: searchStatus.adEarned,
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next day
          canWatchAds: adStatus.canWatch,
          adOptions: adStatus.canWatch ? {
            message: `Watch an ad to earn ${user.adWatching.searchesPerAd} more searches!`,
            remainingAds: adStatus.remainingAds,
            searchesPerAd: user.adWatching.searchesPerAd
          } : null,
          upgradeMessage: 'Upgrade to Premium for unlimited searches!'
        }
      });
    }

    // Add search status to request for use in route handlers
    req.searchStatus = searchStatus;
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Search rate limit error:', error);
    res.status(500).json({ message: 'Server error checking search limits' });
  }
};

// Middleware to increment search count after successful search
const incrementSearchCount = async (req, res, next) => {
  try {
    if (req.userId && req.user) {
      await req.user.incrementSearchCount();
    }
    next();
  } catch (error) {
    console.error('Error incrementing search count:', error);
    // Don't fail the request if we can't increment the counter
    next();
  }
};

module.exports = {
  searchRateLimit,
  incrementSearchCount
};
