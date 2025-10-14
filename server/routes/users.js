const express = require('express');
const User = require('../models/User');
const Auction = require('../models/Auction');
const SavvyPoint = require('../models/SavvyPoint');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user profile
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's auction stats
    const auctionStats = await Auction.aggregate([
      {
        $match: {
          $or: [
            { seller: user._id },
            { winner: user._id }
          ]
        }
      },
      {
        $group: {
          _id: null,
          auctionsCreated: {
            $sum: { $cond: [{ $eq: ['$seller', user._id] }, 1, 0] }
          },
          auctionsWon: {
            $sum: { $cond: [{ $eq: ['$winner', user._id] }, 1, 0] }
          },
          totalBids: {
            $sum: {
              $size: {
                $filter: {
                  input: '$bids',
                  cond: { $eq: ['$$this.bidder', user._id] }
                }
              }
            }
          }
        }
      }
    ]);

    const stats = auctionStats[0] || {
      auctionsCreated: 0,
      auctionsWon: 0,
      totalBids: 0
    };

    res.json({ 
      user,
      stats
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's auctions
router.get('/:id/auctions', async (req, res) => {
  try {
    const { type = 'all', page = 1, limit = 20 } = req.query;
    
    let filter = {};
    if (type === 'selling') {
      filter = { seller: req.params.id };
    } else if (type === 'bidding') {
      filter = { 'bids.bidder': req.params.id };
    } else if (type === 'won') {
      filter = { winner: req.params.id };
    } else {
      filter = {
        $or: [
          { seller: req.params.id },
          { 'bids.bidder': req.params.id },
          { winner: req.params.id }
        ]
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const auctions = await Auction.find(filter)
      .populate('seller', 'username profileImage')
      .populate('winner', 'username profileImage')
      .sort({ createdAt: -1 })
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
    console.error('Get user auctions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Follow/unfollow user
router.post('/:id/follow', auth, async (req, res) => {
  try {
    if (req.params.id === req.user.id.toString()) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const user = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!user || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const isFollowing = currentUser.following && 
      currentUser.following.includes(user._id);

    if (isFollowing) {
      // Unfollow
      currentUser.following = currentUser.following.filter(
        id => id.toString() !== user._id.toString()
      );
      user.followers = user.followers.filter(
        id => id.toString() !== currentUser._id.toString()
      );
    } else {
      // Follow
      if (!currentUser.following) currentUser.following = [];
      if (!user.followers) user.followers = [];
      
      currentUser.following.push(user._id);
      user.followers.push(currentUser._id);
    }

    await currentUser.save();
    await user.save();

    res.json({ 
      message: isFollowing ? 'User unfollowed' : 'User followed',
      isFollowing: !isFollowing
    });
  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's followers/following
router.get('/:id/followers', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'username profileImage')
      .select('followers');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ followers: user.followers });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id/following', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('following', 'username profileImage')
      .select('following');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ following: user.following });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users
router.get('/search/users', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const filter = {
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } }
      ]
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('username firstName lastName profileImage savvyPoints')
      .sort({ username: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's referral/invite information
router.get('/invite-earn', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const referralStats = await user.getReferralStats();
    
    // Get referred users
    const referredUsers = await User.find({ referredBy: user._id })
      .select('username profileImage createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      referralStats,
      referredUsers,
      rewards: {
        referrerReward: 100,
        newUserReward: 50,
        description: 'Earn 100 points for each friend you refer, they get 50 points too!'
      }
    });
  } catch (error) {
    console.error('Get invite earn info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate new referral link
router.post('/generate-referral-link', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure user has a referral code
    if (!user.referralCode) {
      user.referralCode = user._id.toString();
      await user.save();
    }

    const referralLink = user.generateReferralLink();
    const referralStats = await user.getReferralStats();
    
    res.json({
      message: 'Referral link generated successfully',
      referralLink,
      referralCode: user.referralCode,
      referralStats
    });
  } catch (error) {
    console.error('Generate referral link error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Share referral link (track for daily tasks)
router.post('/share-referral', auth, async (req, res) => {
  try {
    const { platform, shareType = 'link' } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const referralLink = user.generateReferralLink();
    
    // Track app sharing for daily tasks
    await user.trackAppShare();
    
    const dailyTasks = user.getDailyTasks();
    
    res.json({
      message: 'Referral shared successfully',
      referralLink,
      platform,
      shareType,
      dailyTasks,
      shareMessage: `Check out Final10 - the smart auction browser! Use my link to get 50 bonus points: ${referralLink}`
    });
  } catch (error) {
    console.error('Share referral error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral leaderboard
router.get('/referral-leaderboard', async (req, res) => {
  try {
    const { period = 'week', limit = 20 } = req.query;
    
    let dateFilter = {};
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    const leaderboard = await User.aggregate([
      { $match: { referralCountToday: { $gt: 0 }, ...dateFilter } },
      {
        $group: {
          _id: '$_id',
          username: { $first: '$username' },
          profileImage: { $first: '$profileImage' },
          totalReferrals: { $sum: '$referralCountToday' },
          points: { $first: '$points' }
        }
      },
      { $sort: { totalReferrals: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      leaderboard,
      period,
      totalUsers: leaderboard.length
    });
  } catch (error) {
    console.error('Get referral leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process referral signup (called during user registration)
router.post('/process-referral', async (req, res) => {
  try {
    const { userId, referralCode } = req.body;
    
    if (!userId || !referralCode) {
      return res.status(400).json({ message: 'User ID and referral code are required' });
    }

    const result = await User.processReferralSignup(userId, referralCode);
    
    res.json({
      message: 'Referral processed successfully',
      ...result
    });
  } catch (error) {
    console.error('Process referral error:', error);
    if (error.message === 'Invalid referral code') {
      return res.status(400).json({ message: 'Invalid referral code' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's point summary
router.get('/:id/points', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    
    let dateFilter = {};
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    const pointSummary = await SavvyPoint.aggregate([
      { $match: { user: req.params.id, ...dateFilter } },
      {
        $group: {
          _id: '$type',
          totalPoints: { $sum: '$points' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalPoints: -1 } }
    ]);

    const user = await User.findById(req.params.id).select('savvyPoints');

    res.json({
      currentBalance: user.savvyPoints,
      summary: pointSummary
    });
  } catch (error) {
    console.error('Get user points error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's eBay connection status
router.get('/:id/ebay-status', auth, async (req, res) => {
  try {
    // Check if user is accessing their own status
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await User.findById(req.params.id).select('ebayAuth');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get comprehensive eBay auth status
    const ebayStatus = user.getEbayAuthStatus();
    
    res.json({
      connected: ebayStatus.isConnected,
      connectedAt: user.ebayAuth.connectedAt,
      hasValidToken: ebayStatus.hasValidToken,
      scopes: ebayStatus.scopes,
      hasBuyBrowsePermissions: ebayStatus.hasBuyBrowsePermissions,
      tokenExpiresAt: ebayStatus.tokenExpiresAt,
      lastTokenRefresh: ebayStatus.lastTokenRefresh,
      needsRefresh: ebayStatus.needsRefresh
    });
  } catch (error) {
    console.error('Get eBay status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

































