import fetch from 'node-fetch';

/**
 * SavvyShield SDK
 * 
 * Cross-app fraud detection and prevention system
 * Sends events to the central Shield API for analysis and enforcement
 */

export interface ShieldEvent {
  type: 'fraud_signal' | 'cheat_signal' | 'user_report' | 'payment_risk' | 
        'behavioral_anomaly' | 'device_reuse' | 'velocity_spike' | 
        'impossible_travel' | 'bot_detection' | 'chargeback_signal' | 
        'ip_reputation' | 'win_rate_anomaly';
  savvy_user_id: string;
  app: string;
  level: 'guest' | 'bronze' | 'silver' | 'gold' | 'vip' | 'platinum';
  context: {
    action?: string;
    value?: number;
    ip_address?: string;
    device_id?: string;
    user_agent?: string;
    location?: {
      country?: string;
      city?: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
    payment_method?: string;
    transaction_id?: string;
    game_session_id?: string;
    betting_amount?: number;
    win_amount?: number;
    auction_id?: string;
    listing_id?: string;
    device_reuse_count?: number;
    velocity_spike?: number;
    impossible_travel?: boolean;
    extras?: Record<string, any>;
  };
  ts?: string;
}

export interface ShieldResponse {
  success: boolean;
  event_id?: string;
  risk_score?: number;
  action?: string;
  enforcement_id?: string;
  message?: string;
}

export interface ShieldConfig {
  apiUrl: string;
  apiKey: string;
  appName: string;
  environment?: string;
  timeout?: number;
  retries?: number;
}

export class SavvyShield {
  private config: ShieldConfig;
  private defaultLevel: string = 'guest';

  constructor(config: ShieldConfig) {
    this.config = {
      timeout: 5000,
      retries: 3,
      environment: 'production',
      ...config
    };

    if (!this.config.apiUrl || !this.config.apiKey || !this.config.appName) {
      throw new Error('Missing required configuration: apiUrl, apiKey, appName');
    }
  }

  /**
   * Send a shield event to the central API
   */
  async sendEvent(event: ShieldEvent): Promise<ShieldResponse> {
    const payload = {
      ...event,
      ts: event.ts || new Date().toISOString(),
      app: this.config.appName
    };

    return this.makeRequest('/ingest', payload);
  }

  /**
   * Send a fraud signal
   */
  async sendFraudSignal(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'fraud_signal',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a cheat signal
   */
  async sendCheatSignal(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'cheat_signal',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a user report
   */
  async sendUserReport(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'user_report',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a payment risk signal
   */
  async sendPaymentRisk(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'payment_risk',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a behavioral anomaly signal
   */
  async sendBehavioralAnomaly(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'behavioral_anomaly',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a velocity spike signal
   */
  async sendVelocitySpike(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'velocity_spike',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a win rate anomaly signal
   */
  async sendWinRateAnomaly(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'win_rate_anomaly',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a device reuse signal
   */
  async sendDeviceReuse(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'device_reuse',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send an impossible travel signal
   */
  async sendImpossibleTravel(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'impossible_travel',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send a bot detection signal
   */
  async sendBotDetection(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'bot_detection',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Send an IP reputation signal
   */
  async sendIPReputation(
    savvy_user_id: string,
    level: string,
    context: ShieldEvent['context']
  ): Promise<ShieldResponse> {
    return this.sendEvent({
      type: 'ip_reputation',
      savvy_user_id,
      level: level as any,
      context
    });
  }

  /**
   * Make HTTP request to Shield API
   */
  private async makeRequest(endpoint: string, payload: any): Promise<ShieldResponse> {
    const url = `${this.config.apiUrl}${endpoint}`;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shield-Key': this.config.apiKey,
        'X-Shield-App': this.config.appName,
        'X-Shield-Environment': this.config.environment || 'production'
      },
      body: JSON.stringify(payload),
      timeout: this.config.timeout
    };

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= (this.config.retries || 3); attempt++) {
      try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${data.message || 'Unknown error'}`);
        }
        
        return data;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Shield API request failed (attempt ${attempt}/${this.config.retries}):`, error);
        
        if (attempt < (this.config.retries || 3)) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw new Error(`Shield API request failed after ${this.config.retries || 3} attempts: ${lastError?.message}`);
  }

  /**
   * Get device ID (browser/client side)
   */
  static getDeviceId(): string {
    if (typeof window !== 'undefined') {
      // Browser environment
      let deviceId = localStorage.getItem('savvy_device_id');
      if (!deviceId) {
        deviceId = 'browser_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('savvy_device_id', deviceId);
      }
      return deviceId;
    } else {
      // Node.js environment
      const os = require('os');
      const crypto = require('crypto');
      const hostname = os.hostname();
      const networkInterfaces = os.networkInterfaces();
      const mac = Object.values(networkInterfaces).flat().find(ni => ni && !ni.internal)?.mac || 'unknown';
      return 'node_' + crypto.createHash('md5').update(hostname + mac).digest('hex').substr(0, 12);
    }
  }

  /**
   * Get user's IP address (server side)
   */
  static getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
  }

  /**
   * Get user agent (server side)
   */
  static getUserAgent(req: any): string {
    return req.get('User-Agent') || req.headers['user-agent'] || 'unknown';
  }
}

/**
 * Convenience function for sending shield events
 */
export async function sendShieldEvent(
  config: ShieldConfig,
  event: ShieldEvent
): Promise<ShieldResponse> {
  const shield = new SavvyShield(config);
  return shield.sendEvent(event);
}

/**
 * Default export
 */
export default SavvyShield;






