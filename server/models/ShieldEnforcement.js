const mongoose = require('mongoose');

const shieldEnforcementSchema = new mongoose.Schema({
  // Core identification
  savvy_user_id: {
    type: String,
    required: true,
    index: true
  },
  app: {
    type: String,
    required: true,
    index: true
  },
  level: {
    type: String,
    required: true,
    enum: ['guest', 'bronze', 'silver', 'gold', 'vip', 'platinum'],
    index: true
  },
  
  // Risk assessment
  risk_score: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    index: true
  },
  risk_factors: [String],
  confidence_level: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  
  // Decision details
  decision: {
    type: String,
    required: true,
    enum: ['observe', 'temp_suspend', 'auto_block', 'soft_restrict', 'suspend_features', 'permanent_ban'],
    index: true
  },
  decision_reason: String,
  decision_factors: [String],
  
  // Enforcement details
  duration_hours: Number,
  features_affected: [String],
  restrictions: {
    betting: Boolean,
    withdrawals: Boolean,
    trading: Boolean,
    promotions: Boolean,
    messaging: Boolean,
    streaming: Boolean,
    custom: [String]
  },
  
  // AI analysis
  ai_analysis: {
    model_version: String,
    analysis_reasoning: String,
    evidence_summary: String,
    false_positive_probability: Number,
    recommended_review_time: Number
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'overridden', 'expired'],
    default: 'pending',
    index: true
  },
  
  // Human review
  human_review: {
    required: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected', 'escalated'],
      default: 'pending'
    },
    reviewed_by: String,
    reviewed_at: Date,
    review_notes: String,
    sla_hours: Number,
    sla_deadline: Date
  },
  
  // Appeals
  appeals: [{
    submitted_at: {
      type: Date,
      default: Date.now
    },
    reason: String,
    evidence: String,
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewed_by: String,
    reviewed_at: Date,
    review_notes: String
  }],
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  activated_at: Date,
  expires_at: Date,
  completed_at: Date,
  
  // Related data
  related_events: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShieldEvent'
  }],
  case_id: {
    type: String,
    index: true
  },
  
  // Enforcement webhook
  webhook_status: {
    sent: Boolean,
    sent_at: Date,
    response_status: Number,
    response_body: String,
    retry_count: {
      type: Number,
      default: 0
    }
  },
  
  // Audit trail
  audit_trail: [{
    action: String,
    performed_by: String,
    performed_at: {
      type: Date,
      default: Date.now
    },
    details: String,
    old_value: mongoose.Schema.Types.Mixed,
    new_value: mongoose.Schema.Types.Mixed
  }],
  
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
shieldEnforcementSchema.index({ savvy_user_id: 1, created_at: -1 });
shieldEnforcementSchema.index({ app: 1, decision: 1, status: 1 });
shieldEnforcementSchema.index({ risk_score: -1, created_at: -1 });
shieldEnforcementSchema.index({ status: 1, created_at: -1 });
shieldEnforcementSchema.index({ 'human_review.status': 1, 'human_review.sla_deadline': 1 });

// Virtual for tier grouping
shieldEnforcementSchema.virtual('tier_group').get(function() {
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

// Virtual for SLA status
shieldEnforcementSchema.virtual('sla_status').get(function() {
  if (!this.human_review.required || !this.human_review.sla_deadline) {
    return 'not_applicable';
  }
  
  const now = new Date();
  if (this.human_review.status === 'pending' && now > this.human_review.sla_deadline) {
    return 'overdue';
  }
  if (this.human_review.status === 'in_review' && now > this.human_review.sla_deadline) {
    return 'overdue';
  }
  if (this.human_review.status === 'approved' || this.human_review.status === 'rejected') {
    return 'completed';
  }
  return 'on_track';
});

// Methods
shieldEnforcementSchema.methods.activate = function() {
  this.status = 'active';
  this.activated_at = new Date();
  
  // Set expiration if duration is specified
  if (this.duration_hours) {
    this.expires_at = new Date();
    this.expires_at.setHours(this.expires_at.getHours() + this.duration_hours);
  }
  
  this.addAuditTrail('activated', 'system', 'Enforcement activated automatically');
  return this.save();
};

shieldEnforcementSchema.methods.complete = function(reason = 'Enforcement period completed') {
  this.status = 'completed';
  this.completed_at = new Date();
  this.addAuditTrail('completed', 'system', reason);
  return this.save();
};

shieldEnforcementSchema.methods.override = function(overriddenBy, reason) {
  this.status = 'overridden';
  this.addAuditTrail('overridden', overriddenBy, reason);
  return this.save();
};

shieldEnforcementSchema.methods.approveReview = function(reviewedBy, notes) {
  this.human_review.status = 'approved';
  this.human_review.reviewed_by = reviewedBy;
  this.human_review.reviewed_at = new Date();
  this.human_review.review_notes = notes;
  
  this.addAuditTrail('review_approved', reviewedBy, notes);
  return this.save();
};

shieldEnforcementSchema.methods.rejectReview = function(reviewedBy, notes) {
  this.human_review.status = 'rejected';
  this.human_review.reviewed_by = reviewedBy;
  this.human_review.reviewed_at = new Date();
  this.human_review.review_notes = notes;
  
  this.addAuditTrail('review_rejected', reviewedBy, notes);
  return this.save();
};

shieldEnforcementSchema.methods.submitAppeal = function(reason, evidence) {
  this.appeals.push({
    reason,
    evidence,
    status: 'pending'
  });
  
  this.addAuditTrail('appeal_submitted', this.savvy_user_id, `Appeal: ${reason}`);
  return this.save();
};

shieldEnforcementSchema.methods.addAuditTrail = function(action, performedBy, details, oldValue = null, newValue = null) {
  this.audit_trail.push({
    action,
    performed_by: performedBy,
    performed_at: new Date(),
    details,
    old_value: oldValue,
    new_value: newValue
  });
  
  // Keep only last 50 audit entries
  if (this.audit_trail.length > 50) {
    this.audit_trail = this.audit_trail.slice(-50);
  }
};

// Static methods
shieldEnforcementSchema.statics.getActiveEnforcements = function() {
  return this.find({
    status: { $in: ['pending', 'active'] }
  }).sort({ risk_score: -1, created_at: -1 });
};

shieldEnforcementSchema.statics.getOverdueReviews = function() {
  const now = new Date();
  return this.find({
    'human_review.required': true,
    'human_review.status': { $in: ['pending', 'in_review'] },
    'human_review.sla_deadline': { $lt: now }
  }).sort({ 'human_review.sla_deadline': 1 });
};

shieldEnforcementSchema.statics.getUserEnforcementHistory = function(savvy_user_id, days = 90) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    savvy_user_id,
    created_at: { $gte: startDate }
  }).sort({ created_at: -1 });
};

shieldEnforcementSchema.statics.getEnforcementStats = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        created_at: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        total_enforcements: { $sum: 1 },
        avg_risk_score: { $avg: '$risk_score' },
        decisions: {
          $push: '$decision'
        },
        statuses: {
          $push: '$status'
        },
        levels: {
          $push: '$level'
        }
      }
    },
    {
      $project: {
        total_enforcements: 1,
        avg_risk_score: 1,
        decision_breakdown: {
          $reduce: {
            input: '$decisions',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $let: {
                    vars: { decision: '$$this' },
                    in: {
                      $mergeObjects: [
                        '$$value',
                        { $arrayToObject: [[{ k: '$$decision', v: 1 }]] }
                      ]
                    }
                  }
                }
              ]
            }
          }
        },
        status_breakdown: {
          $reduce: {
            input: '$statuses',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $let: {
                    vars: { status: '$$this' },
                    in: {
                      $mergeObjects: [
                        '$$value',
                        { $arrayToObject: [[{ k: '$$status', v: 1 }]] }
                      ]
                    }
                  }
                }
              ]
            }
          }
        },
        level_breakdown: {
          $reduce: {
            input: '$levels',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $let: {
                    vars: { level: '$$this' },
                    in: {
                      $mergeObjects: [
                        '$$value',
                        { $arrayToObject: [[{ k: '$$level', v: 1 }]] }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('ShieldEnforcement', shieldEnforcementSchema);






