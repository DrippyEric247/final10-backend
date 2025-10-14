const mongoose = require('mongoose');

const shieldEventSchema = new mongoose.Schema({
  // Core identification
  savvy_user_id: {
    type: String,
    required: true,
    index: true
  },
  app: {
    type: String,
    required: true,
    index: true,
    enum: ['final10', 'savvytrip', 'savvypay', 'hostly-ai', 'ezstay', 'bitesavvy', 'ai-go', 'esta-ai-mate', 'savvysavings', 'savvysecurity', 'savvyshop', 'smokesavvyshop', 'savvykitchen', 'fitsavvy', 'trainsavvy', 'gamesavvy', 'savvysector-vr', 'savvystudio', 'savvystream', 'savvytube', 'savvyclips', 'savvysafari', 'savvyplaylist', 'savvysports', 'savvynews', 'savvycord', 'savvyracing', 'savvyswag', 'rentsavvy', 'real-ai-estate', 'creditsavvy', 'insure-ai', 'savvysetting', 'savvy-vr-world', 'ai-report']
  },
  level: {
    type: String,
    required: true,
    enum: ['guest', 'bronze', 'silver', 'gold', 'vip', 'platinum'],
    index: true
  },
  
  // Event details
  event_type: {
    type: String,
    required: true,
    enum: ['fraud_signal', 'cheat_signal', 'user_report', 'payment_risk', 'behavioral_anomaly', 'device_reuse', 'velocity_spike', 'impossible_travel', 'bot_detection', 'chargeback_signal', 'ip_reputation', 'win_rate_anomaly'],
    index: true
  },
  
  // Context data
  context: {
    action: String,
    value: Number,
    ip_address: String,
    device_id: String,
    user_agent: String,
    location: {
      country: String,
      city: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    payment_method: String,
    transaction_id: String,
    game_session_id: String,
    betting_amount: Number,
    win_amount: Number,
    auction_id: String,
    listing_id: String,
    extras: mongoose.Schema.Types.Mixed
  },
  
  // Risk assessment
  risk_score: {
    type: Number,
    min: 0,
    max: 1,
    index: true
  },
  risk_factors: [String],
  confidence_level: {
    type: Number,
    min: 0,
    max: 1
  },
  
  // Investigation status
  investigation_status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'escalated'],
    default: 'pending',
    index: true
  },
  
  // AI analysis
  ai_analysis: {
    model_version: String,
    analysis_reasoning: String,
    recommended_action: String,
    evidence_summary: String,
    false_positive_probability: Number
  },
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  investigated_at: Date,
  resolved_at: Date,
  
  // Related events
  related_events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShieldEvent'
  }],
  
  // Case management
  case_id: {
    type: String,
    index: true
  },
  
  // Metadata
  metadata: {
    source: String,
    version: String,
    environment: String,
    trace_id: String
  }
}, {
  timestamps: true
});

// Indexes for performance
shieldEventSchema.index({ savvy_user_id: 1, created_at: -1 });
shieldEventSchema.index({ app: 1, event_type: 1, created_at: -1 });
shieldEventSchema.index({ risk_score: -1, created_at: -1 });
shieldEventSchema.index({ investigation_status: 1, created_at: -1 });
shieldEventSchema.index({ case_id: 1, created_at: -1 });

// Virtual for tier grouping
shieldEventSchema.virtual('tier_group').get(function() {
  const tierMap = {
    'guest': 'low',
    'bronze': 'low',
    'silver': 'mid',
    'gold': 'mid',
    'vip': 'high',
    'platinum': 'high'
  };
  return tierMap[this.level] || 'low';
});

// Methods
shieldEventSchema.methods.markAsInvestigated = function() {
  this.investigation_status = 'investigating';
  this.investigated_at = new Date();
  return this.save();
};

shieldEventSchema.methods.markAsResolved = function(action, reason) {
  this.investigation_status = 'resolved';
  this.resolved_at = new Date();
  this.resolution = { action, reason, resolved_at: new Date() };
  return this.save();
};

shieldEventSchema.methods.escalate = function(reason) {
  this.investigation_status = 'escalated';
  this.escalation = { reason, escalated_at: new Date() };
  return this.save();
};

// Static methods
shieldEventSchema.statics.getUserRiskProfile = function(savvy_user_id, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        savvy_user_id,
        created_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$savvy_user_id',
        total_events: { $sum: 1 },
        avg_risk_score: { $avg: '$risk_score' },
        max_risk_score: { $max: '$risk_score' },
        event_types: { $addToSet: '$event_type' },
        apps_used: { $addToSet: '$app' },
        recent_high_risk: {
          $sum: {
            $cond: [{ $gte: ['$risk_score', 0.8] }, 1, 0]
          }
        }
      }
    }
  ]);
};

shieldEventSchema.statics.getActiveInvestigations = function() {
  return this.find({
    investigation_status: { $in: ['pending', 'investigating'] }
  }).sort({ risk_score: -1, created_at: -1 });
};

shieldEventSchema.statics.getHighRiskUsers = function(minScore = 0.8, hours = 24) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);
  
  return this.find({
    risk_score: { $gte: minScore },
    created_at: { $gte: startDate }
  }).sort({ risk_score: -1, created_at: -1 });
};

module.exports = mongoose.model('ShieldEvent', shieldEventSchema);






