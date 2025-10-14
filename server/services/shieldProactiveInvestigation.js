const ShieldEvent = require('../models/ShieldEvent');
const ShieldEnforcement = require('../models/ShieldEnforcement');
const shieldDecisionEngine = require('./shieldDecisionEngine');

/**
 * SavvyShield Proactive Investigation System
 * 
 * Continuously monitors user behavior patterns and investigates suspicious activity
 * before users even get reported. This is the "already investigating" system.
 */
class ShieldProactiveInvestigation {
  constructor() {
    this.investigationRules = [
      new DeviceReuseDetector(),
      new VelocitySpikeDetector(),
      new ImpossibleTravelDetector(),
      new WinRateAnomalyDetector(),
      new PaymentRiskDetector(),
      new BotBehaviorDetector(),
      new IPReputationDetector(),
      new BehavioralPatternDetector()
    ];
    
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Start the proactive investigation system
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Proactive investigation already running');
      return;
    }

    console.log('🚀 Starting SavvyShield Proactive Investigation System...');
    this.isRunning = true;

    // Run investigations every 5 minutes
    this.intervalId = setInterval(async () => {
      await this.runInvestigations();
    }, 5 * 60 * 1000);

    // Run initial investigation
    this.runInvestigations();
  }

  /**
   * Stop the proactive investigation system
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping SavvyShield Proactive Investigation System...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Run all investigation rules
   */
  async runInvestigations() {
    try {
      console.log('🔍 Running proactive investigations...');
      
      for (const rule of this.investigationRules) {
        try {
          await rule.investigate();
        } catch (error) {
          console.error(`❌ Investigation rule ${rule.constructor.name} failed:`, error);
        }
      }
      
      console.log('✅ Proactive investigations completed');
      
    } catch (error) {
      console.error('❌ Proactive investigation system error:', error);
    }
  }

  /**
   * Investigate a specific user based on new events
   */
  async investigateUser(savvy_user_id, app, recentEvents = []) {
    console.log(`🔍 Proactive investigation for user ${savvy_user_id} in ${app}`);
    
    const investigations = [];
    
    for (const rule of this.investigationRules) {
      try {
        const result = await rule.investigateUser(savvy_user_id, app, recentEvents);
        if (result && result.risk_score > 0.6) {
          investigations.push(result);
        }
      } catch (error) {
        console.error(`❌ User investigation rule ${rule.constructor.name} failed:`, error);
      }
    }
    
    // If multiple high-risk indicators, create a comprehensive investigation
    if (investigations.length > 0) {
      await this.createInvestigationCase(savvy_user_id, app, investigations);
    }
    
    return investigations;
  }

  /**
   * Create a comprehensive investigation case
   */
  async createInvestigationCase(savvy_user_id, app, investigations) {
    const avgRiskScore = investigations.reduce((sum, inv) => sum + inv.risk_score, 0) / investigations.length;
    const maxRiskScore = Math.max(...investigations.map(inv => inv.risk_score));
    
    // Get user level
    const User = require('../models/User');
    const user = await User.findOne({ _id: savvy_user_id });
    const userLevel = user?.level || 'guest';
    
    const shieldEvent = new ShieldEvent({
      savvy_user_id,
      app,
      level: userLevel,
      event_type: 'proactive_investigation',
      context: {
        action: 'comprehensive_investigation',
        investigation_count: investigations.length,
        risk_factors: investigations.map(inv => inv.risk_factor),
        evidence: investigations.map(inv => inv.evidence)
      },
      risk_score: maxRiskScore,
      risk_factors: investigations.map(inv => inv.risk_factor),
      confidence_level: 0.8,
      investigation_status: 'investigating',
      ai_analysis: {
        model_version: '1.0.0',
        analysis_reasoning: `Proactive investigation triggered by ${investigations.length} risk indicators`,
        evidence_summary: `Multiple suspicious patterns detected: ${investigations.map(inv => inv.risk_factor).join(', ')}`,
        false_positive_probability: 0.2
      },
      case_id: `proactive_${Date.now()}_${savvy_user_id}`,
      metadata: {
        source: 'proactive_investigation',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
    
    await shieldEvent.save();
    
    // Process the investigation through decision engine
    await shieldDecisionEngine.processEvent(shieldEvent);
    
    console.log(`🎯 Created proactive investigation case for user ${savvy_user_id} (Risk: ${maxRiskScore.toFixed(3)})`);
    
    return shieldEvent;
  }
}

/**
 * Device Reuse Detector
 * Detects when the same device is used across multiple accounts
 */
class DeviceReuseDetector {
  async investigate() {
    // Implementation would analyze device_id patterns across users
    // For now, return mock data
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    // Check if device is used by multiple accounts
    const deviceEvents = await ShieldEvent.find({
      'context.device_id': { $exists: true },
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    const deviceCounts = {};
    deviceEvents.forEach(event => {
      const deviceId = event.context.device_id;
      if (!deviceCounts[deviceId]) {
        deviceCounts[deviceId] = new Set();
      }
      deviceCounts[deviceId].add(event.savvy_user_id);
    });

    // Find devices used by multiple users
    for (const [deviceId, userIds] of Object.entries(deviceCounts)) {
      if (userIds.size > 3) { // Device used by more than 3 users
        const riskScore = Math.min(0.9, 0.5 + (userIds.size - 3) * 0.1);
        
        return {
          risk_factor: 'device_reuse',
          risk_score: riskScore,
          evidence: `Device ${deviceId} used by ${userIds.size} different users in 24h`,
          confidence: 0.8
        };
      }
    }

    return null;
  }
}

/**
 * Velocity Spike Detector
 * Detects unusual transaction velocity patterns
 */
class VelocitySpikeDetector {
  async investigate() {
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    // Analyze transaction velocity
    const userEvents = await ShieldEvent.find({
      savvy_user_id,
      app,
      created_at: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });

    if (userEvents.length > 20) { // More than 20 events in an hour
      const riskScore = Math.min(0.9, 0.6 + (userEvents.length - 20) * 0.01);
      
      return {
        risk_factor: 'velocity_spike',
        risk_score: riskScore,
        evidence: `${userEvents.length} events in 1 hour (normal: <20)`,
        confidence: 0.7
      };
    }

    return null;
  }
}

/**
 * Impossible Travel Detector
 * Detects impossible geographic movements
 */
class ImpossibleTravelDetector {
  async investigate() {
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    // Check for impossible travel patterns
    const locationEvents = await ShieldEvent.find({
      savvy_user_id,
      'context.location.coordinates': { $exists: true },
      created_at: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    }).sort({ created_at: -1 });

    if (locationEvents.length >= 2) {
      const latest = locationEvents[0];
      const previous = locationEvents[1];
      
      const distance = this.calculateDistance(
        latest.context.location.coordinates,
        previous.context.location.coordinates
      );
      
      const timeDiff = (latest.created_at - previous.created_at) / (1000 * 60); // minutes
      
      // If traveled more than 5000km in less than 30 minutes
      if (distance > 5000 && timeDiff < 30) {
        return {
          risk_factor: 'impossible_travel',
          risk_score: 0.8,
          evidence: `Traveled ${distance.toFixed(0)}km in ${timeDiff.toFixed(1)} minutes`,
          confidence: 0.9
        };
      }
    }

    return null;
  }

  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

/**
 * Win Rate Anomaly Detector
 * Detects suspicious win rates in games
 */
class WinRateAnomalyDetector {
  async investigate() {
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    if (app !== 'gamesavvy') return null;

    // Analyze win rate patterns
    const gameEvents = await ShieldEvent.find({
      savvy_user_id,
      app: 'gamesavvy',
      'context.win_amount': { $exists: true },
      created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last week
    });

    if (gameEvents.length >= 10) {
      const wins = gameEvents.filter(e => e.context.win_amount > 0).length;
      const winRate = wins / gameEvents.length;
      
      if (winRate > 0.8) { // 80%+ win rate is suspicious
        return {
          risk_factor: 'win_rate_anomaly',
          risk_score: Math.min(0.9, 0.6 + (winRate - 0.8) * 2),
          evidence: `${(winRate * 100).toFixed(1)}% win rate over ${gameEvents.length} games`,
          confidence: 0.8
        };
      }
    }

    return null;
  }
}

/**
 * Payment Risk Detector
 * Detects payment-related fraud indicators
 */
class PaymentRiskDetector {
  async investigate() {
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    // Check for payment risk indicators
    const paymentEvents = await ShieldEvent.find({
      savvy_user_id,
      event_type: { $in: ['payment_risk', 'chargeback_signal'] },
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (paymentEvents.length > 0) {
      const riskScore = Math.min(0.95, 0.7 + paymentEvents.length * 0.1);
      
      return {
        risk_factor: 'payment_risk',
        risk_score: riskScore,
        evidence: `${paymentEvents.length} payment risk signals in 24h`,
        confidence: 0.9
      };
    }

    return null;
  }
}

/**
 * Bot Behavior Detector
 * Detects automated/bot-like behavior patterns
 */
class BotBehaviorDetector {
  async investigate() {
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    // Analyze for bot-like patterns
    const userEvents = await ShieldEvent.find({
      savvy_user_id,
      created_at: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
    }).sort({ created_at: 1 });

    if (userEvents.length >= 5) {
      // Check for extremely regular intervals (bot-like)
      const intervals = [];
      for (let i = 1; i < userEvents.length; i++) {
        intervals.push(userEvents[i].created_at - userEvents[i-1].created_at);
      }
      
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      
      // If very low variance (very regular intervals), likely bot
      if (stdDev < avgInterval * 0.1) { // Less than 10% variance
        return {
          risk_factor: 'bot_detection',
          risk_score: 0.8,
          evidence: `Extremely regular intervals (std dev: ${stdDev.toFixed(0)}ms)`,
          confidence: 0.7
        };
      }
    }

    return null;
  }
}

/**
 * IP Reputation Detector
 * Checks IP reputation and VPN/proxy usage
 */
class IPReputationDetector {
  async investigate() {
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    // Check IP reputation (mock implementation)
    const ipEvents = await ShieldEvent.find({
      savvy_user_id,
      'context.ip_address': { $exists: true },
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (ipEvents.length > 0) {
      const ip = ipEvents[0].context.ip_address;
      
      // Mock IP reputation check
      const isVPN = this.isVPN(ip);
      const isProxy = this.isProxy(ip);
      const isTor = this.isTor(ip);
      
      if (isVPN || isProxy || isTor) {
        let riskFactor = 'ip_reputation';
        let evidence = '';
        
        if (isVPN) {
          riskFactor = 'vpn_usage';
          evidence = 'VPN detected';
        } else if (isProxy) {
          riskFactor = 'proxy_usage';
          evidence = 'Proxy detected';
        } else if (isTor) {
          riskFactor = 'tor_usage';
          evidence = 'Tor network detected';
        }
        
        return {
          risk_factor: riskFactor,
          risk_score: 0.6,
          evidence: evidence,
          confidence: 0.8
        };
      }
    }

    return null;
  }

  isVPN(ip) {
    // Mock VPN detection
    return ip.startsWith('10.') || ip.startsWith('192.168.');
  }

  isProxy(ip) {
    // Mock proxy detection
    return false;
  }

  isTor(ip) {
    // Mock Tor detection
    return false;
  }
}

/**
 * Behavioral Pattern Detector
 * Detects unusual behavioral patterns
 */
class BehavioralPatternDetector {
  async investigate() {
    return [];
  }

  async investigateUser(savvy_user_id, app, recentEvents) {
    // Analyze behavioral patterns
    const userEvents = await ShieldEvent.find({
      savvy_user_id,
      created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    if (userEvents.length >= 20) {
      // Check for unusual activity hours (e.g., always 3 AM)
      const hourCounts = {};
      userEvents.forEach(event => {
        const hour = event.created_at.getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      
      const maxHourCount = Math.max(...Object.values(hourCounts));
      const totalEvents = userEvents.length;
      
      // If 80%+ of activity is in one hour, suspicious
      if (maxHourCount / totalEvents > 0.8) {
        const suspiciousHour = Object.keys(hourCounts).find(h => hourCounts[h] === maxHourCount);
        
        return {
          risk_factor: 'behavioral_anomaly',
          risk_score: 0.6,
          evidence: `${(maxHourCount / totalEvents * 100).toFixed(1)}% of activity at hour ${suspiciousHour}`,
          confidence: 0.6
        };
      }
    }

    return null;
  }
}

module.exports = new ShieldProactiveInvestigation();






