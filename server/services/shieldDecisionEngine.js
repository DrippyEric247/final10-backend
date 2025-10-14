const ShieldEvent = require('../models/ShieldEvent');
const ShieldEnforcement = require('../models/ShieldEnforcement');

/**
 * SavvyShield Decision Engine
 * 
 * Level-aware fraud detection and enforcement system
 * Implements tier-based actions based on user level and risk score
 */
class ShieldDecisionEngine {
  constructor() {
    // Tier mapping for user levels
    this.tierMap = {
      'guest': 'low',
      'bronze': 'low',
      'silver': 'mid',
      'gold': 'mid',
      'vip': 'high',
      'platinum': 'high'
    };
    
    // Risk thresholds
    this.riskThresholds = {
      observe: 0.6,
      moderate: 0.75,
      high: 0.9,
      critical: 0.95
    };
    
    // SLA requirements by tier
    this.slaRequirements = {
      low: 24,    // 24 hours for low tier
      mid: 12,    // 12 hours for mid tier
      high: 4     // 4 hours for high tier
    };
  }

  /**
   * Main decision function - determines enforcement action based on level and risk score
   */
  async decide(level, riskScore, context = {}) {
    const tier = this.tierMap[level] || 'low';
    const confidence = context.confidence || 0.8;
    const riskFactors = context.riskFactors || [];
    
    console.log(`🤖 Shield Decision: Level=${level}, Tier=${tier}, Risk=${riskScore}, Confidence=${confidence}`);
    
    // Low risk - observe only
    if (riskScore < this.riskThresholds.observe) {
      return {
        action: 'observe',
        tier: tier,
        risk_score: riskScore,
        confidence: confidence,
        reasoning: 'Risk score below threshold - monitoring only',
        sla_hours: null,
        features_affected: [],
        restrictions: {}
      };
    }
    
    // Moderate risk - tier-based actions
    if (riskScore < this.riskThresholds.moderate) {
      return this.handleModerateRisk(tier, riskScore, confidence, riskFactors);
    }
    
    // High risk - more aggressive actions
    if (riskScore < this.riskThresholds.high) {
      return this.handleHighRisk(tier, riskScore, confidence, riskFactors);
    }
    
    // Critical risk - immediate action required
    return this.handleCriticalRisk(tier, riskScore, confidence, riskFactors);
  }

  /**
   * Handle moderate risk (0.6 - 0.75)
   */
  handleModerateRisk(tier, riskScore, confidence, riskFactors) {
    const baseReasoning = `Moderate risk detected (${riskScore.toFixed(3)}) - tier-based action`;
    
    switch (tier) {
      case 'low':
        return {
          action: 'temp_suspend',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: 24,
          reasoning: `${baseReasoning} - Low tier temporary suspension`,
          sla_hours: this.slaRequirements.low,
          features_affected: ['betting', 'withdrawals', 'trading'],
          restrictions: {
            betting: true,
            withdrawals: true,
            trading: true,
            promotions: false,
            messaging: false
          }
        };
        
      case 'mid':
        return {
          action: 'temp_suspend',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: 12,
          reasoning: `${baseReasoning} - Mid tier temporary suspension`,
          sla_hours: this.slaRequirements.mid,
          features_affected: ['betting', 'withdrawals'],
          restrictions: {
            betting: true,
            withdrawals: true,
            trading: false,
            promotions: false,
            messaging: false
          }
        };
        
      case 'high':
        return {
          action: 'soft_restrict',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: null,
          reasoning: `${baseReasoning} - High tier soft restrictions`,
          sla_hours: this.slaRequirements.high,
          features_affected: ['high_value_betting'],
          restrictions: {
            betting: false,
            withdrawals: false,
            trading: false,
            promotions: false,
            messaging: false,
            custom: ['high_value_betting']
          }
        };
    }
  }

  /**
   * Handle high risk (0.75 - 0.9)
   */
  handleHighRisk(tier, riskScore, confidence, riskFactors) {
    const baseReasoning = `High risk detected (${riskScore.toFixed(3)}) - aggressive action`;
    
    switch (tier) {
      case 'low':
        return {
          action: 'auto_block',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: 72,
          reasoning: `${baseReasoning} - Low tier auto-block`,
          sla_hours: this.slaRequirements.low,
          features_affected: ['all'],
          restrictions: {
            betting: true,
            withdrawals: true,
            trading: true,
            promotions: true,
            messaging: true
          }
        };
        
      case 'mid':
        return {
          action: 'temp_suspend',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: 48,
          reasoning: `${baseReasoning} - Mid tier extended suspension`,
          sla_hours: this.slaRequirements.mid,
          features_affected: ['betting', 'withdrawals', 'trading', 'promotions'],
          restrictions: {
            betting: true,
            withdrawals: true,
            trading: true,
            promotions: true,
            messaging: false
          }
        };
        
      case 'high':
        return {
          action: 'soft_restrict',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: null,
          reasoning: `${baseReasoning} - High tier feature restrictions`,
          sla_hours: this.slaRequirements.high,
          features_affected: ['high_value_operations'],
          restrictions: {
            betting: false,
            withdrawals: false,
            trading: false,
            promotions: false,
            messaging: false,
            custom: ['high_value_operations', 'bulk_operations']
          }
        };
    }
  }

  /**
   * Handle critical risk (0.9+)
   */
  handleCriticalRisk(tier, riskScore, confidence, riskFactors) {
    const baseReasoning = `Critical risk detected (${riskScore.toFixed(3)}) - immediate action`;
    
    switch (tier) {
      case 'low':
        return {
          action: 'auto_block',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: null, // Indefinite until review
          reasoning: `${baseReasoning} - Low tier immediate block`,
          sla_hours: this.slaRequirements.low,
          features_affected: ['all'],
          restrictions: {
            betting: true,
            withdrawals: true,
            trading: true,
            promotions: true,
            messaging: true
          }
        };
        
      case 'mid':
        return {
          action: 'auto_block',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: null, // Indefinite until review
          reasoning: `${baseReasoning} - Mid tier immediate block with review`,
          sla_hours: this.slaRequirements.mid,
          features_affected: ['all'],
          restrictions: {
            betting: true,
            withdrawals: true,
            trading: true,
            promotions: true,
            messaging: true
          }
        };
        
      case 'high':
        return {
          action: 'suspend_features',
          tier: tier,
          risk_score: riskScore,
          confidence: confidence,
          duration_hours: null,
          reasoning: `${baseReasoning} - High tier feature suspension with urgent review`,
          sla_hours: 2, // 2 hours for high tier critical
          features_affected: ['high_risk_features'],
          restrictions: {
            betting: true,
            withdrawals: true,
            trading: true,
            promotions: false,
            messaging: false,
            custom: ['high_risk_features', 'admin_functions']
          }
        };
    }
  }

  /**
   * Create enforcement record from decision
   */
  async createEnforcement(decision, shieldEvent) {
    const enforcement = new ShieldEnforcement({
      savvy_user_id: shieldEvent.savvy_user_id,
      app: shieldEvent.app,
      level: shieldEvent.level,
      risk_score: decision.risk_score,
      risk_factors: shieldEvent.risk_factors || [],
      confidence_level: decision.confidence,
      
      decision: decision.action,
      decision_reason: decision.reasoning,
      decision_factors: decision.features_affected,
      
      duration_hours: decision.duration_hours,
      features_affected: decision.features_affected,
      restrictions: decision.restrictions,
      
      ai_analysis: {
        model_version: '1.0.0',
        analysis_reasoning: decision.reasoning,
        evidence_summary: shieldEvent.ai_analysis?.evidence_summary || 'AI analysis pending',
        false_positive_probability: 1 - decision.confidence,
        recommended_review_time: decision.sla_hours
      },
      
      human_review: {
        required: decision.action !== 'observe',
        status: 'pending',
        sla_hours: decision.sla_hours,
        sla_deadline: decision.sla_hours ? new Date(Date.now() + (decision.sla_hours * 60 * 60 * 1000)) : null
      },
      
      related_events: [shieldEvent._id],
      case_id: shieldEvent.case_id || `case_${Date.now()}_${shieldEvent.savvy_user_id}`,
      
      metadata: {
        source: 'shield_decision_engine',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        trace_id: shieldEvent.metadata?.trace_id
      }
    });

    await enforcement.save();
    
    console.log(`✅ Created enforcement: ${enforcement.decision} for user ${shieldEvent.savvy_user_id} (${shieldEvent.level})`);
    
    return enforcement;
  }

  /**
   * Process a shield event and create enforcement if needed
   */
  async processEvent(shieldEvent) {
    try {
      // Calculate risk score if not provided
      let riskScore = shieldEvent.risk_score;
      if (!riskScore) {
        riskScore = await this.calculateRiskScore(shieldEvent);
        shieldEvent.risk_score = riskScore;
        await shieldEvent.save();
      }
      
      // Make decision
      const decision = await this.decide(
        shieldEvent.level,
        riskScore,
        {
          confidence: shieldEvent.confidence_level || 0.8,
          riskFactors: shieldEvent.risk_factors || []
        }
      );
      
      // Create enforcement if action is not 'observe'
      if (decision.action !== 'observe') {
        const enforcement = await this.createEnforcement(decision, shieldEvent);
        
        // Trigger enforcement webhook
        await this.triggerEnforcementWebhook(enforcement);
        
        return { decision, enforcement };
      }
      
      return { decision, enforcement: null };
      
    } catch (error) {
      console.error('❌ Error processing shield event:', error);
      throw error;
    }
  }

  /**
   * Calculate risk score based on event data
   */
  async calculateRiskScore(shieldEvent) {
    let score = 0.1; // Base score
    
    // Event type scoring
    const eventTypeScores = {
      'fraud_signal': 0.8,
      'cheat_signal': 0.7,
      'user_report': 0.6,
      'payment_risk': 0.9,
      'behavioral_anomaly': 0.5,
      'device_reuse': 0.8,
      'velocity_spike': 0.6,
      'impossible_travel': 0.7,
      'bot_detection': 0.8,
      'chargeback_signal': 0.9,
      'ip_reputation': 0.6,
      'win_rate_anomaly': 0.7
    };
    
    score += eventTypeScores[shieldEvent.event_type] || 0.3;
    
    // Value-based scoring
    if (shieldEvent.context?.value) {
      const value = shieldEvent.context.value;
      if (value > 1000) score += 0.2;
      if (value > 5000) score += 0.1;
      if (value > 10000) score += 0.1;
    }
    
    // Context-based adjustments
    if (shieldEvent.context?.device_reuse_count > 5) score += 0.2;
    if (shieldEvent.context?.velocity_spike > 10) score += 0.15;
    if (shieldEvent.context?.impossible_travel) score += 0.2;
    
    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Trigger enforcement webhook to the specific app
   */
  async triggerEnforcementWebhook(enforcement) {
    try {
      const webhookUrl = `${process.env.SHIELD_WEBHOOK_BASE_URL}/${enforcement.app}/shield/enforce`;
      
      const payload = {
        savvy_user_id: enforcement.savvy_user_id,
        action: enforcement.decision,
        features: enforcement.features_affected,
        duration_hours: enforcement.duration_hours,
        reason: enforcement.decision_reason,
        restrictions: enforcement.restrictions,
        risk_score: enforcement.risk_score,
        enforcement_id: enforcement._id,
        case_id: enforcement.case_id
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shield-Signature': this.generateSignature(payload),
          'X-Shield-Timestamp': Date.now().toString()
        },
        body: JSON.stringify(payload)
      });
      
      enforcement.webhook_status = {
        sent: true,
        sent_at: new Date(),
        response_status: response.status,
        response_body: await response.text(),
        retry_count: 0
      };
      
      await enforcement.save();
      
      console.log(`📡 Enforcement webhook sent to ${enforcement.app}: ${response.status}`);
      
    } catch (error) {
      console.error('❌ Webhook error:', error);
      
      enforcement.webhook_status = {
        sent: false,
        sent_at: new Date(),
        response_status: 0,
        response_body: error.message,
        retry_count: (enforcement.webhook_status?.retry_count || 0) + 1
      };
      
      await enforcement.save();
    }
  }

  /**
   * Generate webhook signature for security
   */
  generateSignature(payload) {
    const crypto = require('crypto');
    const secret = process.env.SHIELD_WEBHOOK_SECRET || 'default_secret';
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Get enforcement statistics
   */
  async getStats(days = 30) {
    return await ShieldEnforcement.getEnforcementStats(days);
  }

  /**
   * Get overdue reviews
   */
  async getOverdueReviews() {
    return await ShieldEnforcement.getOverdueReviews();
  }

  /**
   * Get active enforcements
   */
  async getActiveEnforcements() {
    return await ShieldEnforcement.getActiveEnforcements();
  }
}

module.exports = new ShieldDecisionEngine();






