const express = require('express');
const router = express.Router();
const ShieldEvent = require('../models/ShieldEvent');
const ShieldEnforcement = require('../models/ShieldEnforcement');
const shieldDecisionEngine = require('../services/shieldDecisionEngine');
const shieldProactiveInvestigation = require('../services/shieldProactiveInvestigation');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Admin-only middleware for Shield management
const requireShieldAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.canManageShield()) {
      return res.status(403).json({ 
        message: 'Shield admin access required. Only superadmin can manage SavvyShield.',
        required: 'superadmin',
        current: user?.role || 'none'
      });
    }
    req.shieldAdmin = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking admin permissions' });
  }
};

/**
 * POST /api/shield/ingest
 * Ingest shield events from SavvyShield SDK
 */
router.post('/ingest', async (req, res) => {
  try {
    const {
      type,
      savvy_user_id,
      app,
      level,
      context
    } = req.body;

    // Validate required fields
    if (!type || !savvy_user_id || !app || !level) {
      return res.status(400).json({
        message: 'Missing required fields: type, savvy_user_id, app, level'
      });
    }

    // Map type to event_type
    const eventTypeMap = {
      'fraud_signal': 'fraud_signal',
      'cheat_signal': 'cheat_signal',
      'user_report': 'user_report',
      'payment_risk': 'payment_risk',
      'behavioral_anomaly': 'behavioral_anomaly',
      'device_reuse': 'device_reuse',
      'velocity_spike': 'velocity_spike',
      'impossible_travel': 'impossible_travel',
      'bot_detection': 'bot_detection',
      'chargeback_signal': 'chargeback_signal',
      'ip_reputation': 'ip_reputation',
      'win_rate_anomaly': 'win_rate_anomaly'
    };

    const event_type = eventTypeMap[type] || 'behavioral_anomaly';

    // Create shield event
    const shieldEvent = new ShieldEvent({
      savvy_user_id,
      app,
      level,
      event_type,
      context: {
        ...context,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent'),
        timestamp: new Date()
      },
      investigation_status: 'pending',
      metadata: {
        source: 'shield_sdk',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        trace_id: req.headers['x-trace-id']
      }
    });

    await shieldEvent.save();

    console.log(`📡 Shield event ingested: ${event_type} for user ${savvy_user_id} in ${app}`);

    // Process event through decision engine
    const result = await shieldDecisionEngine.processEvent(shieldEvent);

    // Trigger proactive investigation for high-risk events
    if (result.decision && result.decision.risk_score > 0.6) {
      await shieldProactiveInvestigation.investigateUser(savvy_user_id, app, [shieldEvent]);
    }

    res.json({
      success: true,
      event_id: shieldEvent._id,
      risk_score: result.decision?.risk_score || 0,
      action: result.decision?.action || 'observe',
      enforcement_id: result.enforcement?._id || null
    });

  } catch (error) {
    console.error('Error ingesting shield event:', error);
    res.status(500).json({
      message: 'Failed to ingest shield event',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/shield/events
 * Get shield events (superadmin only)
 */
router.get('/events', requireShieldAdmin, async (req, res) => {
  try {

    const {
      page = 1,
      limit = 50,
      savvy_user_id,
      app,
      event_type,
      risk_score_min,
      investigation_status,
      days = 7
    } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const filter = {
      created_at: { $gte: startDate }
    };

    if (savvy_user_id) filter.savvy_user_id = savvy_user_id;
    if (app) filter.app = app;
    if (event_type) filter.event_type = event_type;
    if (risk_score_min) filter.risk_score = { $gte: parseFloat(risk_score_min) };
    if (investigation_status) filter.investigation_status = investigation_status;

    const events = await ShieldEvent.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit) * 1)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('related_events');

    const total = await ShieldEvent.countDocuments(filter);

    res.json({
      success: true,
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching shield events:', error);
    res.status(500).json({ message: 'Failed to fetch shield events' });
  }
});

/**
 * GET /api/shield/enforcements
 * Get shield enforcements (superadmin only)
 */
router.get('/enforcements', requireShieldAdmin, async (req, res) => {
  try {

    const {
      page = 1,
      limit = 50,
      savvy_user_id,
      app,
      decision,
      status,
      days = 30
    } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const filter = {
      created_at: { $gte: startDate }
    };

    if (savvy_user_id) filter.savvy_user_id = savvy_user_id;
    if (app) filter.app = app;
    if (decision) filter.decision = decision;
    if (status) filter.status = status;

    const enforcements = await ShieldEnforcement.find(filter)
      .sort({ created_at: -1 })
      .limit(parseInt(limit) * 1)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('related_events');

    const total = await ShieldEnforcement.countDocuments(filter);

    res.json({
      success: true,
      enforcements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error fetching shield enforcements:', error);
    res.status(500).json({ message: 'Failed to fetch shield enforcements' });
  }
});

/**
 * GET /api/shield/stats
 * Get shield statistics (superadmin only)
 */
router.get('/stats', requireShieldAdmin, async (req, res) => {
  try {

    const { days = 30 } = req.query;
    const daysInt = parseInt(days);

    // Get enforcement stats
    const enforcementStats = await shieldDecisionEngine.getStats(daysInt);
    
    // Get event stats
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysInt);

    const eventStats = await ShieldEvent.aggregate([
      {
        $match: {
          created_at: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total_events: { $sum: 1 },
          avg_risk_score: { $avg: '$risk_score' },
          high_risk_events: {
            $sum: {
              $cond: [{ $gte: ['$risk_score', 0.8] }, 1, 0]
            }
          },
          event_types: {
            $push: '$event_type'
          },
          apps: {
            $push: '$app'
          },
          levels: {
            $push: '$level'
          }
        }
      }
    ]);

    // Get overdue reviews
    const overdueReviews = await shieldDecisionEngine.getOverdueReviews();

    // Get active enforcements
    const activeEnforcements = await shieldDecisionEngine.getActiveEnforcements();

    res.json({
      success: true,
      stats: {
        enforcement: enforcementStats[0] || {},
        events: eventStats[0] || {},
        overdue_reviews: overdueReviews.length,
        active_enforcements: activeEnforcements.length,
        period_days: daysInt
      }
    });

  } catch (error) {
    console.error('Error fetching shield stats:', error);
    res.status(500).json({ message: 'Failed to fetch shield stats' });
  }
});

/**
 * POST /api/shield/enforcements/:id/approve
 * Approve an enforcement (superadmin only)
 */
router.post('/enforcements/:id/approve', requireShieldAdmin, async (req, res) => {
  try {

    const { id } = req.params;
    const { notes } = req.body;

    const enforcement = await ShieldEnforcement.findById(id);
    if (!enforcement) {
      return res.status(404).json({ message: 'Enforcement not found' });
    }

    await enforcement.approveReview(user.username, notes);

    res.json({
      success: true,
      message: 'Enforcement approved',
      enforcement
    });

  } catch (error) {
    console.error('Error approving enforcement:', error);
    res.status(500).json({ message: 'Failed to approve enforcement' });
  }
});

/**
 * POST /api/shield/enforcements/:id/reject
 * Reject an enforcement (superadmin only)
 */
router.post('/enforcements/:id/reject', requireShieldAdmin, async (req, res) => {
  try {

    const { id } = req.params;
    const { notes } = req.body;

    const enforcement = await ShieldEnforcement.findById(id);
    if (!enforcement) {
      return res.status(404).json({ message: 'Enforcement not found' });
    }

    await enforcement.rejectReview(user.username, notes);

    res.json({
      success: true,
      message: 'Enforcement rejected',
      enforcement
    });

  } catch (error) {
    console.error('Error rejecting enforcement:', error);
    res.status(500).json({ message: 'Failed to reject enforcement' });
  }
});

/**
 * POST /api/shield/enforcements/:id/override
 * Override an enforcement (superadmin only)
 */
router.post('/enforcements/:id/override', requireShieldAdmin, async (req, res) => {
  try {

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Override reason is required' });
    }

    const enforcement = await ShieldEnforcement.findById(id);
    if (!enforcement) {
      return res.status(404).json({ message: 'Enforcement not found' });
    }

    await enforcement.override(user.username, reason);

    res.json({
      success: true,
      message: 'Enforcement overridden',
      enforcement
    });

  } catch (error) {
    console.error('Error overriding enforcement:', error);
    res.status(500).json({ message: 'Failed to override enforcement' });
  }
});

/**
 * GET /api/shield/user/:savvy_user_id/profile
 * Get user risk profile (superadmin only)
 */
router.get('/user/:savvy_user_id/profile', requireShieldAdmin, async (req, res) => {
  try {

    const { savvy_user_id } = req.params;
    const { days = 90 } = req.query;

    // Get user risk profile
    const riskProfile = await ShieldEvent.getUserRiskProfile(savvy_user_id, parseInt(days));
    
    // Get enforcement history
    const enforcementHistory = await ShieldEnforcement.getUserEnforcementHistory(savvy_user_id, parseInt(days));

    res.json({
      success: true,
      user_id: savvy_user_id,
      risk_profile: riskProfile[0] || null,
      enforcement_history: enforcementHistory,
      period_days: parseInt(days)
    });

  } catch (error) {
    console.error('Error fetching user risk profile:', error);
    res.status(500).json({ message: 'Failed to fetch user risk profile' });
  }
});

/**
 * POST /api/shield/investigate/:savvy_user_id
 * Manually trigger investigation for a user (superadmin only)
 */
router.post('/investigate/:savvy_user_id', requireShieldAdmin, async (req, res) => {
  try {

    const { savvy_user_id } = req.params;
    const { app = 'final10' } = req.body;

    // Trigger investigation
    const investigations = await shieldProactiveInvestigation.investigateUser(savvy_user_id, app);

    res.json({
      success: true,
      message: 'Investigation triggered',
      investigations,
      user_id: savvy_user_id,
      app
    });

  } catch (error) {
    console.error('Error triggering investigation:', error);
    res.status(500).json({ message: 'Failed to trigger investigation' });
  }
});

/**
 * POST /api/shield/start-proactive
 * Start proactive investigation system (superadmin only)
 */
router.post('/start-proactive', requireShieldAdmin, async (req, res) => {
  try {

    shieldProactiveInvestigation.start();

    res.json({
      success: true,
      message: 'Proactive investigation system started'
    });

  } catch (error) {
    console.error('Error starting proactive investigation:', error);
    res.status(500).json({ message: 'Failed to start proactive investigation' });
  }
});

/**
 * POST /api/shield/stop-proactive
 * Stop proactive investigation system (superadmin only)
 */
router.post('/stop-proactive', requireShieldAdmin, async (req, res) => {
  try {

    shieldProactiveInvestigation.stop();

    res.json({
      success: true,
      message: 'Proactive investigation system stopped'
    });

  } catch (error) {
    console.error('Error stopping proactive investigation:', error);
    res.status(500).json({ message: 'Failed to stop proactive investigation' });
  }
});

module.exports = router;
