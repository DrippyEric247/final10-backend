const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Superadmin-only middleware for owner control
const requireSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isSuperAdmin()) {
      return res.status(403).json({ 
        message: 'Superadmin access required. Only the system owner can access this.',
        required: 'superadmin',
        current: user?.role || 'none'
      });
    }
    req.superAdmin = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking superadmin permissions' });
  }
};

/**
 * GET /api/owner/search-users
 * Search for users by username, email, or ID
 */
router.get('/search-users', requireSuperAdmin, async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        message: 'Search query must be at least 2 characters long' 
      });
    }
    
    const searchRegex = new RegExp(query, 'i');
    
    const users = await User.find({
      $or: [
        { username: searchRegex },
        { email: searchRegex },
        { _id: query }
      ]
    })
    .select('username email role membershipTier isPremium points savvyPoints pointsBalance lifetimePointsEarned subscriptionExpires createdAt lastActive')
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        points: user.points,
        savvyPoints: user.savvyPoints,
        pointsBalance: user.pointsBalance,
        lifetimePointsEarned: user.lifetimePointsEarned,
        subscriptionExpires: user.subscriptionExpires,
        memberSince: user.createdAt,
        lastActive: user.lastActive,
        hasLifetimeSub: user.subscriptionExpires === null && user.isPremium
      })),
      total: users.length
    });
    
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

/**
 * GET /api/owner/user/:userId
 * Get detailed user information
 */
router.get('/user/:userId', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires,
        points: user.points,
        savvyPoints: user.savvyPoints,
        pointsBalance: user.pointsBalance,
        lifetimePointsEarned: user.lifetimePointsEarned,
        badges: user.badges,
        referralCode: user.referralCode,
        referralCodeUsed: user.referralCodeUsed,
        totalTransactions: user.totalTransactions,
        memberSince: user.createdAt,
        lastActive: user.lastActive,
        ebayConnected: user.ebayAuth?.isConnected || false,
        hasLifetimeSub: user.subscriptionExpires === null && user.isPremium
      }
    });
    
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Failed to fetch user details' });
  }
});

/**
 * POST /api/owner/grant-points
 * Grant points to a user (Owner Perk)
 */
router.post('/grant-points', requireSuperAdmin, async (req, res) => {
  try {
    const { userId, points, reason = 'Owner grant' } = req.body;
    
    if (!userId || !points || points <= 0) {
      return res.status(400).json({ 
        message: 'Valid user ID and positive points amount required' 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Grant points
    user.points += points;
    user.savvyPoints += points;
    user.pointsBalance += points;
    user.lifetimePointsEarned += points;
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'points',
      amount: points,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`🎯 Owner granted ${points} points to user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully granted ${points} points to ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        newPointsBalance: user.pointsBalance,
        newLifetimePoints: user.lifetimePointsEarned
      }
    });
    
  } catch (error) {
    console.error('Error granting points:', error);
    res.status(500).json({ message: 'Failed to grant points' });
  }
});

/**
 * POST /api/owner/grant-lifetime-subscription
 * Grant lifetime subscription to a user (Owner Perk)
 */
router.post('/grant-lifetime-subscription', requireSuperAdmin, async (req, res) => {
  try {
    const { userId, reason = 'Owner grant - Lifetime subscription' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Grant lifetime subscription
    user.membershipTier = 'pro';
    user.isPremium = true;
    user.subscriptionExpires = null; // null = lifetime
    user.subscriptionEnd = null; // null = lifetime
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'lifetime_subscription',
      amount: null,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`👑 Owner granted lifetime subscription to user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully granted lifetime subscription to ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires
      }
    });
    
  } catch (error) {
    console.error('Error granting lifetime subscription:', error);
    res.status(500).json({ message: 'Failed to grant lifetime subscription' });
  }
});

/**
 * POST /api/owner/revoke-lifetime-subscription
 * Revoke lifetime subscription from a user (Owner Perk)
 */
router.post('/revoke-lifetime-subscription', requireSuperAdmin, async (req, res) => {
  try {
    const { userId, reason = 'Owner revoke - Lifetime subscription' } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Revoke lifetime subscription
    user.membershipTier = 'free';
    user.isPremium = false;
    user.subscriptionExpires = new Date(); // Set to past date
    user.subscriptionEnd = new Date(); // Set to past date
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'revoke_lifetime_subscription',
      amount: null,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`🚫 Owner revoked lifetime subscription from user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully revoked lifetime subscription from ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires
      }
    });
    
  } catch (error) {
    console.error('Error revoking lifetime subscription:', error);
    res.status(500).json({ message: 'Failed to revoke lifetime subscription' });
  }
});

/**
 * POST /api/owner/grant-premium-subscription
 * Grant premium subscription for specific duration (Owner Perk)
 */
router.post('/grant-premium-subscription', requireSuperAdmin, async (req, res) => {
  try {
    const { userId, durationMonths = 12, reason = 'Owner grant - Premium subscription' } = req.body;
    
    if (!userId || !durationMonths || durationMonths <= 0) {
      return res.status(400).json({ 
        message: 'Valid user ID and positive duration required' 
      });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Grant premium subscription
    user.membershipTier = 'premium';
    user.isPremium = true;
    
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + durationMonths);
    
    user.subscriptionExpires = subscriptionEnd;
    user.subscriptionEnd = subscriptionEnd;
    
    // Add to audit trail
    user.ownerGrants = user.ownerGrants || [];
    user.ownerGrants.push({
      type: 'premium_subscription',
      amount: durationMonths,
      reason: reason,
      grantedBy: req.superAdmin.username,
      grantedAt: new Date()
    });
    
    await user.save();
    
    console.log(`⭐ Owner granted ${durationMonths}-month premium subscription to user ${user.username} (${userId})`);
    
    res.json({
      success: true,
      message: `Successfully granted ${durationMonths}-month premium subscription to ${user.username}`,
      user: {
        id: user._id,
        username: user.username,
        membershipTier: user.membershipTier,
        isPremium: user.isPremium,
        subscriptionExpires: user.subscriptionExpires
      }
    });
    
  } catch (error) {
    console.error('Error granting premium subscription:', error);
    res.status(500).json({ message: 'Failed to grant premium subscription' });
  }
});

/**
 * GET /api/owner/user/:userId/grants
 * Get owner grants history for a user
 */
router.get('/user/:userId/grants', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('username ownerGrants');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      success: true,
      username: user.username,
      grants: user.ownerGrants || []
    });
    
  } catch (error) {
    console.error('Error fetching user grants:', error);
    res.status(500).json({ message: 'Failed to fetch user grants' });
  }
});

/**
 * GET /api/owner/stats
 * Get owner control panel statistics
 */
router.get('/stats', requireSuperAdmin, async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get premium users
    const premiumUsers = await User.countDocuments({ isPremium: true });
    
    // Get lifetime subscribers
    const lifetimeUsers = await User.countDocuments({ 
      isPremium: true, 
      subscriptionExpires: null 
    });
    
    // Get total points granted by owner
    const usersWithGrants = await User.find({ 
      ownerGrants: { $exists: true, $ne: [] } 
    });
    
    const totalOwnerGrants = usersWithGrants.reduce((total, user) => {
      const pointsGrants = user.ownerGrants.filter(grant => grant.type === 'points');
      return total + pointsGrants.reduce((sum, grant) => sum + (grant.amount || 0), 0);
    }, 0);
    
    // Get recent owner grants
    const recentGrants = await User.find({ 
      ownerGrants: { $exists: true, $ne: [] } 
    })
    .select('username ownerGrants')
    .sort({ 'ownerGrants.grantedAt': -1 })
    .limit(10);
    
    const recentGrantsList = [];
    recentGrants.forEach(user => {
      user.ownerGrants.forEach(grant => {
        recentGrantsList.push({
          username: user.username,
          type: grant.type,
          amount: grant.amount,
          reason: grant.reason,
          grantedBy: grant.grantedBy,
          grantedAt: grant.grantedAt
        });
      });
    });
    
    recentGrantsList.sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt));
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        lifetimeUsers,
        totalOwnerGrants,
        recentGrants: recentGrantsList.slice(0, 10)
      }
    });
    
  } catch (error) {
    console.error('Error fetching owner stats:', error);
    res.status(500).json({ message: 'Failed to fetch owner statistics' });
  }
});

module.exports = router;






