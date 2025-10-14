// Add this to your backend routes to test User model
// This should be added to your users.js routes file

const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Test endpoint to verify User model eBay methods
router.get('/test-ebay-model', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Test User model methods
    const ebayStatus = user.getEbayAuthStatus();
    const hasConnected = user.hasEbayConnected();
    const hasValidToken = user.isEbayTokenValid();

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        ebayAuth: {
          isConnected: hasConnected,
          hasValidToken: hasValidToken,
          status: ebayStatus
        }
      }
    });
  } catch (error) {
    console.error('User model test error:', error);
    res.status(500).json({ 
      error: 'User model test failed',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;















