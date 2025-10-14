const express = require('express');
const router = express.Router();
const User = require('../models/User');
const UserLevel = require('../models/UserLevel');
const auth = require('../middleware/auth');

// GET /api/levels/me - Get current user's level information
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const levelInfo = await user.getLevelInfo();
    
    res.json({
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        profileImage: user.profileImage
      },
      level: levelInfo,
      points: user.points
    });
  } catch (error) {
    console.error('Get level info error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/levels/leaderboard - Get level leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50, type = 'level' } = req.query;
    
    let leaderboard;
    if (type === 'xp') {
      leaderboard = await UserLevel.find()
        .populate('userId', 'username profileImage firstName lastName')
        .sort({ totalXP: -1, currentLevel: -1 })
        .limit(parseInt(limit));
    } else {
      leaderboard = await UserLevel.getLevelLeaderboard(parseInt(limit));
    }
    
    // Format leaderboard data
    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: {
        id: entry.userId._id,
        username: entry.userId.username,
        firstName: entry.userId.firstName,
        profileImage: entry.userId.profileImage
      },
      level: entry.currentLevel,
      totalXP: entry.totalXP,
      stats: entry.stats
    }));
    
    res.json({
      leaderboard: formattedLeaderboard,
      type,
      total: formattedLeaderboard.length
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/levels/award-xp - Award XP to user (admin only)
router.post('/award-xp', auth, async (req, res) => {
  try {
    const { userId, xpAmount, source = 'manual' } = req.body;
    
    // Check if user is admin (you can implement admin check)
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || currentUser.membershipTier !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const result = await user.awardXP(xpAmount, source);
    
    res.json({
      message: 'XP awarded successfully',
      result,
      user: {
        id: user._id,
        username: user.username,
        level: result.newLevel,
        totalXP: result.xpInfo.currentLevelStart + result.xpInfo.xpProgress
      }
    });
  } catch (error) {
    console.error('Award XP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/levels/milestones - Get user's milestones
router.get('/milestones', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const levelInfo = await user.getLevelInfo();
    
    // Define all possible milestones
    const allMilestones = [
      { level: 5, name: 'Rookie Trader', description: 'Reached level 5', reward: 250, icon: '🥉' },
      { level: 10, name: 'Smart Shopper', description: 'Reached level 10', reward: 500, icon: '🥈' },
      { level: 15, name: 'Auction Expert', description: 'Reached level 15', reward: 750, icon: '🥇' },
      { level: 20, name: 'Deal Hunter', description: 'Reached level 20', reward: 1000, icon: '🏆' },
      { level: 25, name: 'Bargain Master', description: 'Reached level 25', reward: 1500, icon: '👑' },
      { level: 30, name: 'Final10 Legend', description: 'Reached level 30', reward: 2000, icon: '🌟' },
      { level: 50, name: 'Auction God', description: 'Reached level 50', reward: 5000, icon: '⚡' }
    ];
    
    // Mark which milestones are achieved
    const milestones = allMilestones.map(milestone => {
      const achieved = levelInfo.milestones.some(m => m.milestone === milestone.name);
      return {
        ...milestone,
        achieved,
        achievedAt: achieved ? levelInfo.milestones.find(m => m.milestone === milestone.name)?.achievedAt : null
      };
    });
    
    res.json({
      milestones,
      currentLevel: levelInfo.currentLevel,
      nextMilestone: milestones.find(m => !m.achieved)
    });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/levels/stats - Get user's level statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const levelInfo = await user.getLevelInfo();
    
    res.json({
      stats: levelInfo.stats,
      level: levelInfo.currentLevel,
      totalXP: levelInfo.totalXP,
      xpInfo: levelInfo.xpInfo
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
