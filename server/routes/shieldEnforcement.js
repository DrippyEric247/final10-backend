const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');

/**
 * Shield Enforcement Webhook
 * 
 * This endpoint receives enforcement actions from the central Shield system
 * and applies them to the Final10 app
 */

/**
 * POST /shield/enforce
 * Receive enforcement actions from Shield
 */
router.post('/enforce', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-shield-signature'];
    const timestamp = req.headers['x-shield-timestamp'];
    
    if (!signature || !timestamp) {
      return res.status(401).json({ message: 'Missing signature or timestamp' });
    }
    
    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 300000) { // 5 minutes
      return res.status(401).json({ message: 'Request too old' });
    }
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.SHIELD_WEBHOOK_SECRET || 'default_secret')
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ message: 'Invalid signature' });
    }
    
    const {
      savvy_user_id,
      action,
      features,
      duration_hours,
      reason,
      restrictions,
      risk_score,
      enforcement_id,
      case_id
    } = req.body;
    
    console.log(`🛡️  Shield enforcement received: ${action} for user ${savvy_user_id} (Risk: ${risk_score})`);
    
    // Find user
    const user = await User.findById(savvy_user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Apply enforcement based on action
    let enforcementResult = {};
    
    switch (action) {
      case 'observe':
        // No action needed, just monitoring
        enforcementResult = { action: 'observe', applied: true };
        break;
        
      case 'temp_suspend':
        await applyTempSuspend(user, duration_hours, features, restrictions);
        enforcementResult = { action: 'temp_suspend', applied: true, duration_hours };
        break;
        
      case 'auto_block':
        await applyAutoBlock(user, duration_hours, features, restrictions);
        enforcementResult = { action: 'auto_block', applied: true, duration_hours };
        break;
        
      case 'soft_restrict':
        await applySoftRestrict(user, features, restrictions);
        enforcementResult = { action: 'soft_restrict', applied: true };
        break;
        
      case 'suspend_features':
        await applyFeatureSuspend(user, features, restrictions);
        enforcementResult = { action: 'suspend_features', applied: true };
        break;
        
      default:
        console.log(`⚠️  Unknown enforcement action: ${action}`);
        enforcementResult = { action, applied: false, reason: 'Unknown action' };
    }
    
    // Log enforcement
    console.log(`✅ Enforcement applied: ${action} for user ${savvy_user_id}`);
    
    res.json({
      success: true,
      message: 'Enforcement applied successfully',
      enforcement_id,
      case_id,
      user_id: savvy_user_id,
      action,
      applied: enforcementResult.applied,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Shield enforcement error:', error);
    res.status(500).json({
      message: 'Failed to apply enforcement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Apply temporary suspension
 */
async function applyTempSuspend(user, duration_hours, features, restrictions) {
  const suspendUntil = new Date();
  suspendUntil.setHours(suspendUntil.getHours() + (duration_hours || 24));
  
  // Add suspension to user record
  user.shield_suspension = {
    active: true,
    type: 'temp_suspend',
    suspended_until: suspendUntil,
    features_blocked: features || [],
    restrictions: restrictions || {},
    reason: 'Shield enforcement - temporary suspension'
  };
  
  await user.save();
  
  console.log(`🔒 User ${user.username} suspended until ${suspendUntil}`);
}

/**
 * Apply auto-block
 */
async function applyAutoBlock(user, duration_hours, features, restrictions) {
  const blockUntil = duration_hours ? 
    new Date(Date.now() + (duration_hours * 60 * 60 * 1000)) : 
    null; // Indefinite block
  
  user.shield_block = {
    active: true,
    type: 'auto_block',
    blocked_until: blockUntil,
    features_blocked: features || ['all'],
    restrictions: restrictions || {},
    reason: 'Shield enforcement - automatic block'
  };
  
  // Revoke all active sessions
  user.refresh_tokens = [];
  
  await user.save();
  
  console.log(`🚫 User ${user.username} blocked${blockUntil ? ` until ${blockUntil}` : ' indefinitely'}`);
}

/**
 * Apply soft restrictions
 */
async function applySoftRestrict(user, features, restrictions) {
  user.shield_restrictions = {
    active: true,
    type: 'soft_restrict',
    restricted_features: features || [],
    restrictions: restrictions || {},
    reason: 'Shield enforcement - soft restrictions'
  };
  
  await user.save();
  
  console.log(`⚠️  Soft restrictions applied to user ${user.username}`);
}

/**
 * Apply feature suspension
 */
async function applyFeatureSuspend(user, features, restrictions) {
  user.shield_feature_suspend = {
    active: true,
    type: 'suspend_features',
    suspended_features: features || [],
    restrictions: restrictions || {},
    reason: 'Shield enforcement - feature suspension'
  };
  
  await user.save();
  
  console.log(`🔧 Features suspended for user ${user.username}: ${features?.join(', ') || 'all'}`);
}

/**
 * Middleware to check if user is blocked by Shield
 */
function checkShieldStatus(req, res, next) {
  if (!req.user) {
    return next();
  }
  
  const user = req.user;
  
  // Check for active suspension
  if (user.shield_suspension?.active) {
    if (user.shield_suspension.suspended_until && new Date() > user.shield_suspension.suspended_until) {
      // Suspension expired, remove it
      user.shield_suspension.active = false;
      user.save();
    } else {
      return res.status(403).json({
        message: 'Account temporarily suspended',
        suspension: {
          type: user.shield_suspension.type,
          suspended_until: user.shield_suspension.suspended_until,
          reason: user.shield_suspension.reason
        }
      });
    }
  }
  
  // Check for active block
  if (user.shield_block?.active) {
    if (user.shield_block.blocked_until && new Date() > user.shield_block.blocked_until) {
      // Block expired, remove it
      user.shield_block.active = false;
      user.save();
    } else {
      return res.status(403).json({
        message: 'Account blocked by Shield security system',
        block: {
          type: user.shield_block.type,
          blocked_until: user.shield_block.blocked_until,
          reason: user.shield_block.reason
        }
      });
    }
  }
  
  // Check for feature restrictions
  if (user.shield_restrictions?.active) {
    req.shield_restrictions = user.shield_restrictions;
  }
  
  // Check for feature suspension
  if (user.shield_feature_suspend?.active) {
    req.shield_suspended_features = user.shield_feature_suspend.suspended_features;
  }
  
  next();
}

/**
 * Middleware to check specific feature access
 */
function checkFeatureAccess(feature) {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    // Check if feature is suspended
    if (req.shield_suspended_features?.includes(feature)) {
      return res.status(403).json({
        message: `Feature '${feature}' is currently suspended`,
        feature,
        reason: 'Shield enforcement'
      });
    }
    
    // Check if feature is restricted
    if (req.shield_restrictions?.restricted_features?.includes(feature)) {
      return res.status(403).json({
        message: `Feature '${feature}' is restricted`,
        feature,
        reason: req.shield_restrictions.reason
      });
    }
    
    next();
  };
}

/**
 * GET /shield/status/:user_id
 * Get Shield status for a user (admin only)
 */
router.get('/status/:user_id', async (req, res) => {
  try {
    // Check if requesting user is admin
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const user = await User.findById(req.params.user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const shieldStatus = {
      user_id: user._id,
      username: user.username,
      level: user.level,
      suspension: user.shield_suspension,
      block: user.shield_block,
      restrictions: user.shield_restrictions,
      feature_suspend: user.shield_feature_suspend,
      active_enforcements: []
    };
    
    // Check if any enforcements are active
    if (user.shield_suspension?.active) {
      shieldStatus.active_enforcements.push({
        type: 'suspension',
        active: true,
        until: user.shield_suspension.suspended_until
      });
    }
    
    if (user.shield_block?.active) {
      shieldStatus.active_enforcements.push({
        type: 'block',
        active: true,
        until: user.shield_block.blocked_until
      });
    }
    
    if (user.shield_restrictions?.active) {
      shieldStatus.active_enforcements.push({
        type: 'restrictions',
        active: true
      });
    }
    
    if (user.shield_feature_suspend?.active) {
      shieldStatus.active_enforcements.push({
        type: 'feature_suspend',
        active: true,
        features: user.shield_feature_suspend.suspended_features
      });
    }
    
    res.json({
      success: true,
      shield_status: shieldStatus
    });
    
  } catch (error) {
    console.error('Error fetching Shield status:', error);
    res.status(500).json({ message: 'Failed to fetch Shield status' });
  }
});

module.exports = {
  router,
  checkShieldStatus,
  checkFeatureAccess
};






