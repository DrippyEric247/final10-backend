const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SavvyPoint = require('../models/SavvyPoint');
const auth = require('../middleware/auth');

// Easter egg codes with their rewards
const EASTER_EGG_CODES = {
  'TRAILER2024': { 
    points: 500, 
    name: 'Trailer Master', 
    icon: '🎬',
    description: 'Found the trailer easter egg!',
    category: 'trailer'
  },
  'TEASER2024': { 
    points: 300, 
    name: 'Teaser Hunter', 
    icon: '🔍',
    description: 'Discovered the teaser code!',
    category: 'teaser'
  },
  'EASTEREGG': { 
    points: 1000, 
    name: 'Easter Egg Finder', 
    icon: '🥚',
    description: 'Ultimate easter egg hunter!',
    category: 'special'
  },
  'STAYSAVVY': { 
    points: 250, 
    name: 'Savvy Viewer', 
    icon: '💡',
    description: 'You are truly savvy!',
    category: 'brand'
  },
  'STAYEARNING': { 
    points: 200, 
    name: 'Earning Pro', 
    icon: '💰',
    description: 'Master of earning!',
    category: 'brand'
  },
  'FINAL10': { 
    points: 150, 
    name: 'Final10 Fan', 
    icon: '🎯',
    description: 'True Final10 supporter!',
    category: 'brand'
  },
  'LAUNCH2024': {
    points: 750,
    name: 'Launch Explorer',
    icon: '🚀',
    description: 'Early adopter bonus!',
    category: 'launch'
  },
  'BETAUSER': {
    points: 600,
    name: 'Beta Tester',
    icon: '🧪',
    description: 'Thank you for testing!',
    category: 'beta'
  }
};

// Track redeemed codes per user to prevent duplicates
const redeemedCodes = new Map(); // In production, store this in Redis or database

// Apply auth middleware to all routes
router.use(auth);

// Redeem easter egg code
router.post('/redeem', async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ message: 'Code is required' });
    }

    const upperCode = code.toUpperCase();
    
    // Check if code exists
    if (!EASTER_EGG_CODES[upperCode]) {
      return res.status(400).json({ 
        message: 'Invalid redeem code. Keep watching our trailers for easter eggs! 🎬' 
      });
    }

    // Check if user has already redeemed this code
    const userRedeemedKey = `${userId}_${upperCode}`;
    if (redeemedCodes.has(userRedeemedKey)) {
      return res.status(400).json({ 
        message: 'You have already redeemed this code!' 
      });
    }

    // Get easter egg data
    const easterEgg = EASTER_EGG_CODES[upperCode];
    
    // Award points using your existing SavvyPoint system
    await SavvyPoint.awardPoints(
      userId,
      easterEgg.points,
      'easter_egg',
      `${easterEgg.description} (Code: ${upperCode})`,
      upperCode,
      'EasterEgg',
      1
    );

    // Update user's points balance
    const user = await User.findById(userId);
    if (user) {
      user.pointsBalance += easterEgg.points;
      user.lifetimePointsEarned += easterEgg.points;
      await user.save();
    }

    // Mark code as redeemed for this user
    redeemedCodes.set(userRedeemedKey, {
      userId,
      code: upperCode,
      points: easterEgg.points,
      redeemedAt: new Date(),
      easterEgg
    });

    // Clean up old redemptions (keep last 1000 entries)
    if (redeemedCodes.size > 1000) {
      const entries = Array.from(redeemedCodes.entries());
      const toDelete = entries.slice(0, entries.length - 1000);
      toDelete.forEach(([key]) => redeemedCodes.delete(key));
    }

    res.json({
      success: true,
      message: `🎉 Amazing! You found the ${easterEgg.name} easter egg! +${easterEgg.points} points!`,
      easterEgg: {
        code: upperCode,
        name: easterEgg.name,
        points: easterEgg.points,
        icon: easterEgg.icon,
        description: easterEgg.description,
        category: easterEgg.category
      },
      pointsEarned: easterEgg.points,
      newBalance: user.pointsBalance
    });

  } catch (error) {
    console.error('Error redeeming easter egg code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available easter egg codes (for hints)
router.get('/available', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get codes this user has already redeemed
    const userRedeemedCodes = Array.from(redeemedCodes.entries())
      .filter(([key]) => key.startsWith(`${userId}_`))
      .map(([, value]) => value.code);

    // Filter out redeemed codes and return available ones
    const availableCodes = Object.entries(EASTER_EGG_CODES)
      .filter(([code]) => !userRedeemedCodes.includes(code))
      .map(([code, data]) => ({
        code,
        name: data.name,
        icon: data.icon,
        points: data.points,
        category: data.category,
        description: data.description
      }));

    res.json({
      available: availableCodes,
      totalAvailable: availableCodes.length,
      totalCodes: Object.keys(EASTER_EGG_CODES).length
    });

  } catch (error) {
    console.error('Error getting available easter egg codes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's redemption history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's redemption history
    const userRedemptions = Array.from(redeemedCodes.entries())
      .filter(([key]) => key.startsWith(`${userId}_`))
      .map(([, value]) => ({
        code: value.code,
        name: value.easterEgg.name,
        points: value.points,
        icon: value.easterEgg.icon,
        category: value.easterEgg.category,
        redeemedAt: value.redeemedAt
      }))
      .sort((a, b) => new Date(b.redeemedAt) - new Date(a.redeemedAt));

    res.json({
      redemptions: userRedemptions,
      totalRedeemed: userRedemptions.length,
      totalPointsEarned: userRedemptions.reduce((sum, r) => sum + r.points, 0)
    });

  } catch (error) {
    console.error('Error getting redemption history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get easter egg statistics (for admin)
router.get('/stats', async (req, res) => {
  try {
    // Check if user is admin (you might want to add proper admin middleware)
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get redemption statistics
    const totalRedemptions = redeemedCodes.size;
    const totalPointsAwarded = Array.from(redeemedCodes.values())
      .reduce((sum, r) => sum + r.points, 0);

    // Get redemption count per code
    const codeStats = {};
    Array.from(redeemedCodes.values()).forEach(redemption => {
      const code = redemption.code;
      if (!codeStats[code]) {
        codeStats[code] = {
          code,
          name: redemption.easterEgg.name,
          points: redemption.easterEgg.points,
          redemptions: 0,
          totalPointsAwarded: 0
        };
      }
      codeStats[code].redemptions++;
      codeStats[code].totalPointsAwarded += redemption.points;
    });

    res.json({
      totalRedemptions,
      totalPointsAwarded,
      uniqueUsers: new Set(Array.from(redeemedCodes.values()).map(r => r.userId)).size,
      codeStats: Object.values(codeStats).sort((a, b) => b.redemptions - a.redemptions),
      availableCodes: Object.keys(EASTER_EGG_CODES).length
    });

  } catch (error) {
    console.error('Error getting easter egg statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new easter egg code (admin only)
router.post('/admin/add', async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { code, points, name, icon, description, category } = req.body;

    if (!code || !points || !name) {
      return res.status(400).json({ 
        message: 'Code, points, and name are required' 
      });
    }

    const upperCode = code.toUpperCase();
    
    if (EASTER_EGG_CODES[upperCode]) {
      return res.status(400).json({ 
        message: 'Easter egg code already exists' 
      });
    }

    EASTER_EGG_CODES[upperCode] = {
      points: parseInt(points),
      name,
      icon: icon || '🎁',
      description: description || `Found the ${name} easter egg!`,
      category: category || 'special'
    };

    res.json({
      success: true,
      message: 'Easter egg code added successfully',
      code: upperCode,
      easterEgg: EASTER_EGG_CODES[upperCode]
    });

  } catch (error) {
    console.error('Error adding easter egg code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove easter egg code (admin only)
router.delete('/admin/:code', async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { code } = req.params;
    const upperCode = code.toUpperCase();

    if (!EASTER_EGG_CODES[upperCode]) {
      return res.status(404).json({ 
        message: 'Easter egg code not found' 
      });
    }

    delete EASTER_EGG_CODES[upperCode];

    // Remove from redeemed codes as well
    Array.from(redeemedCodes.keys()).forEach(key => {
      if (key.endsWith(`_${upperCode}`)) {
        redeemedCodes.delete(key);
      }
    });

    res.json({
      success: true,
      message: 'Easter egg code removed successfully'
    });

  } catch (error) {
    console.error('Error removing easter egg code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;








