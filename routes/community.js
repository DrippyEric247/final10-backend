const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Alert = require('../models/Alert');
const Auction = require('../models/Auction');

// Community goals configuration
const COMMUNITY_GOALS = {
  savvyPoints: {
    target: 1000000,
    reward: {
      points: 10000,
      subscription: 1 // months
    }
  },
  activeAlerts: {
    target: 100000,
    reward: {
      points: 10000,
      subscription: 1
    }
  },
  auctionsWon: {
    target: 100000,
    reward: {
      points: 10000,
      subscription: 1
    }
  },
  timeSaved: {
    target: 8760, // 1 year in hours
    reward: {
      points: 10000,
      subscription: 1
    }
  }
};

// GET /api/community/goals - Get community goals
router.get('/goals', (req, res) => {
  try {
    res.json(COMMUNITY_GOALS);
  } catch (error) {
    console.error('Error fetching community goals:', error);
    res.status(500).json({ message: 'Failed to fetch community goals' });
  }
});

// GET /api/community/progress - Get current community progress
router.get('/progress', async (req, res) => {
  try {
    // Calculate total savvy points across all users
    const totalSavvyPoints = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$savvyPoints' } } }
    ]);

    // Count total active alerts
    const activeAlertsCount = await Alert.countDocuments({ isActive: true });

    // Count total auctions won
    const auctionsWonCount = await Auction.countDocuments({ status: 'completed' });

    // Calculate total time saved (assuming 1 hour per transaction)
    const totalTransactions = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalTransactions' } } }
    ]);

    const timeSaved = (totalTransactions[0]?.total || 0) * 1; // 1 hour per transaction

    // Check if user can claim reward (if any goal is completed and user hasn't claimed)
    let canClaimReward = false;
    if (req.user) {
      const user = await User.findById(req.user.id);
      if (user && !user.hasClaimedCommunityReward) {
        const progress = {
          savvyPoints: totalSavvyPoints[0]?.total || 0,
          activeAlerts: activeAlertsCount,
          auctionsWon: auctionsWonCount,
          timeSaved: timeSaved
        };

        // Check if any goal is completed
        const goals = Object.keys(COMMUNITY_GOALS);
        canClaimReward = goals.some(goalKey => {
          const goal = COMMUNITY_GOALS[goalKey];
          const current = progress[goalKey];
          return current >= goal.target;
        });
      }
    }

    const progress = {
      savvyPoints: totalSavvyPoints[0]?.total || 0,
      activeAlerts: activeAlertsCount,
      auctionsWon: auctionsWonCount,
      timeSaved: timeSaved,
      canClaimReward
    };

    res.json(progress);
  } catch (error) {
    console.error('Error fetching community progress:', error);
    res.status(500).json({ message: 'Failed to fetch community progress' });
  }
});

// POST /api/community/claim-reward - Claim community reward
router.post('/claim-reward', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.hasClaimedCommunityReward) {
      return res.status(400).json({ message: 'Reward already claimed' });
    }

    // Check if any goal is completed
    const totalSavvyPoints = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$savvyPoints' } } }
    ]);
    const activeAlertsCount = await Alert.countDocuments({ isActive: true });
    const auctionsWonCount = await Auction.countDocuments({ status: 'completed' });
    const totalTransactions = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalTransactions' } } }
    ]);
    const timeSaved = (totalTransactions[0]?.total || 0) * 1;

    const currentProgress = {
      savvyPoints: totalSavvyPoints[0]?.total || 0,
      activeAlerts: activeAlertsCount,
      auctionsWon: auctionsWonCount,
      timeSaved: timeSaved
    };

    // Check if any goal is completed
    const goals = Object.keys(COMMUNITY_GOALS);
    const completedGoal = goals.find(goalKey => {
      const goal = COMMUNITY_GOALS[goalKey];
      const current = currentProgress[goalKey];
      return current >= goal.target;
    });

    if (!completedGoal) {
      return res.status(400).json({ message: 'No community goals have been completed yet' });
    }

    // Award the reward
    const reward = COMMUNITY_GOALS[completedGoal].reward;
    
    // Add points
    user.savvyPoints += reward.points;
    
    // Add subscription months
    const currentDate = new Date();
    const subscriptionEnd = user.subscriptionEnd ? new Date(user.subscriptionEnd) : currentDate;
    if (subscriptionEnd < currentDate) {
      subscriptionEnd.setTime(currentDate.getTime());
    }
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + reward.subscription);
    user.subscriptionEnd = subscriptionEnd;
    user.isPremium = true;
    
    // Mark as claimed
    user.hasClaimedCommunityReward = true;
    
    await user.save();

    res.json({
      message: 'Reward claimed successfully!',
      points: reward.points,
      subscription: reward.subscription,
      completedGoal: completedGoal,
      currentProgress
    });

  } catch (error) {
    console.error('Error claiming community reward:', error);
    res.status(500).json({ message: 'Failed to claim reward' });
  }
});

// GET /api/community/leaderboard - Get community leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'points', limit = 50 } = req.query;

    let leaderboard = [];

    switch (type) {
      case 'points':
        leaderboard = await User.find({})
          .select('username firstName savvyPoints')
          .sort({ savvyPoints: -1 })
          .limit(parseInt(limit));
        break;
      
      case 'alerts':
        leaderboard = await User.aggregate([
          { $lookup: { from: 'alerts', localField: '_id', foreignField: 'userId', as: 'alerts' } },
          { $project: { username: 1, firstName: 1, alertCount: { $size: '$alerts' } } },
          { $sort: { alertCount: -1 } },
          { $limit: parseInt(limit) }
        ]);
        break;
      
      case 'auctions':
        leaderboard = await User.aggregate([
          { $lookup: { from: 'auctions', localField: '_id', foreignField: 'sellerId', as: 'auctions' } },
          { $project: { username: 1, firstName: 1, auctionCount: { $size: '$auctions' } } },
          { $sort: { auctionCount: -1 } },
          { $limit: parseInt(limit) }
        ]);
        break;
      
      default:
        return res.status(400).json({ message: 'Invalid leaderboard type' });
    }

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching community leaderboard:', error);
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
