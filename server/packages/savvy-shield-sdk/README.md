# @savvy/shield-sdk

**SavvyShield SDK** - Cross-app fraud detection and prevention system for the Savvy Universe.

## 🚀 **Features**

- **Cross-App Integration**: Works across all 30+ Savvy Universe apps
- **Real-time Detection**: Instant fraud and cheat detection
- **Level-Aware Enforcement**: Different actions based on user tier
- **Proactive Investigation**: AI investigates before users get reported
- **Automatic Enforcement**: AI-powered decision making and actions

## 📦 **Installation**

```bash
npm install @savvy/shield-sdk
```

## 🔧 **Configuration**

```typescript
import { SavvyShield } from '@savvy/shield-sdk';

const shield = new SavvyShield({
  apiUrl: 'https://shield.savvyuniverse.com/api/shield',
  apiKey: process.env.SHIELD_API_KEY,
  appName: 'final10', // or any Savvy app
  environment: 'production'
});
```

## 🎯 **Usage Examples**

### **Basic Event Sending**

```typescript
// Send a fraud signal
await shield.sendFraudSignal('user_123', 'silver', {
  action: 'suspicious_payment',
  value: 999.99,
  transaction_id: 'tx_456'
});

// Send a cheat signal
await shield.sendCheatSignal('user_123', 'gold', {
  action: 'impossible_win',
  game_session_id: 'game_789',
  win_amount: 50000
});

// Send a user report
await shield.sendUserReport('user_123', 'bronze', {
  action: 'reported_for_cheating',
  reported_by: 'user_456'
});
```

### **Advanced Event Types**

```typescript
// Velocity spike detection
await shield.sendVelocitySpike('user_123', 'vip', {
  action: 'rapid_transactions',
  velocity_spike: 15, // 15x normal rate
  time_window: '1_hour'
});

// Device reuse detection
await shield.sendDeviceReuse('user_123', 'platinum', {
  action: 'device_sharing',
  device_id: 'device_abc',
  device_reuse_count: 8
});

// Impossible travel detection
await shield.sendImpossibleTravel('user_123', 'gold', {
  action: 'impossible_movement',
  location: {
    coordinates: { lat: 40.7128, lng: -74.0060 },
    city: 'New York'
  },
  impossible_travel: true
});
```

### **Integration in Express Routes**

```typescript
import express from 'express';
import { SavvyShield } from '@savvy/shield-sdk';

const app = express();
const shield = new SavvyShield({
  apiUrl: process.env.SHIELD_API_URL,
  apiKey: process.env.SHIELD_API_KEY,
  appName: 'final10'
});

// Payment route with fraud detection
app.post('/api/payment', async (req, res) => {
  const { user_id, amount, payment_method } = req.body;
  
  // Send payment risk signal
  await shield.sendPaymentRisk(user_id, 'silver', {
    action: 'payment_attempt',
    value: amount,
    payment_method,
    ip_address: SavvyShield.getClientIP(req),
    device_id: req.headers['x-device-id']
  });
  
  // Process payment...
  res.json({ success: true });
});

// Game route with cheat detection
app.post('/api/game/bet', async (req, res) => {
  const { user_id, bet_amount, game_result } = req.body;
  
  // Check for impossible wins
  if (game_result.win_amount > bet_amount * 100) {
    await shield.sendCheatSignal(user_id, 'gold', {
      action: 'impossible_win',
      betting_amount: bet_amount,
      win_amount: game_result.win_amount,
      game_session_id: req.session.id
    });
  }
  
  res.json({ success: true, result: game_result });
});
```

### **Middleware Integration**

```typescript
import { SavvyShield } from '@savvy/shield-sdk';

const shield = new SavvyShield(config);

// Shield middleware
const shieldMiddleware = (req, res, next) => {
  // Add shield instance to request
  req.shield = shield;
  next();
};

// Usage in route
app.use(shieldMiddleware);

app.post('/api/sensitive-action', async (req, res) => {
  const { user_id, action } = req.body;
  
  // Send behavioral anomaly signal
  await req.shield.sendBehavioralAnomaly(user_id, 'bronze', {
    action: 'sensitive_action',
    ip_address: SavvyShield.getClientIP(req),
    user_agent: SavvyShield.getUserAgent(req),
    device_id: SavvyShield.getDeviceId()
  });
  
  // Process action...
});
```

## 🛡️ **Event Types**

| Event Type | Description | Use Case |
|------------|-------------|----------|
| `fraud_signal` | General fraud indicators | Suspicious transactions, fake accounts |
| `cheat_signal` | Gaming/fair play violations | Impossible wins, bot behavior |
| `user_report` | User-reported violations | Community reports, harassment |
| `payment_risk` | Payment fraud indicators | Chargebacks, stolen cards |
| `behavioral_anomaly` | Unusual behavior patterns | Rapid actions, suspicious timing |
| `device_reuse` | Device sharing across accounts | Multiple accounts on same device |
| `velocity_spike` | Unusual activity rates | Rapid transactions, spam behavior |
| `impossible_travel` | Geographic impossibilities | Login from distant locations |
| `bot_detection` | Automated behavior | Scripted actions, CAPTCHA bypass |
| `chargeback_signal` | Payment disputes | Chargeback notifications |
| `ip_reputation` | IP-based risk | VPN, proxy, known bad IPs |
| `win_rate_anomaly` | Suspicious win rates | Gaming fraud, statistical impossibilities |

## 🎯 **User Levels**

| Level | Tier | Enforcement | SLA |
|-------|------|-------------|-----|
| `guest` | Low | Aggressive | 24h |
| `bronze` | Low | Moderate | 24h |
| `silver` | Mid | Balanced | 12h |
| `gold` | Mid | Lenient | 12h |
| `vip` | High | Minimal | 4h |
| `platinum` | High | Minimal | 4h |

## 🔒 **Security**

- **API Key Authentication**: Secure API key required
- **Request Signing**: Cryptographic request signatures
- **Rate Limiting**: Built-in rate limiting protection
- **Data Encryption**: All data encrypted in transit
- **Privacy Compliant**: GDPR/CCPA compliant data handling

## 📊 **Response Format**

```typescript
interface ShieldResponse {
  success: boolean;
  event_id?: string;
  risk_score?: number;        // 0.0 - 1.0
  action?: string;            // 'observe', 'temp_suspend', 'auto_block', etc.
  enforcement_id?: string;    // If enforcement was created
  message?: string;
}
```

## 🚀 **Best Practices**

1. **Send Events Early**: Send signals as soon as suspicious activity is detected
2. **Include Context**: Provide rich context data for better AI analysis
3. **Handle Responses**: Check risk scores and actions in responses
4. **Monitor Performance**: Track SDK performance and error rates
5. **Update Regularly**: Keep SDK updated for latest features

## 🔧 **Environment Variables**

```bash
# Required
SHIELD_API_URL=https://shield.savvyuniverse.com/api/shield
SHIELD_API_KEY=your_shield_api_key

# Optional
SHIELD_ENVIRONMENT=production
SHIELD_TIMEOUT=5000
SHIELD_RETRIES=3
```

## 📈 **Monitoring**

The SDK automatically logs events and performance metrics:

- Event send success/failure rates
- API response times
- Error rates and types
- Risk score distributions

## 🆘 **Support**

- **Documentation**: [docs.savvyuniverse.com/shield](https://docs.savvyuniverse.com/shield)
- **Issues**: [GitHub Issues](https://github.com/savvyuniverse/shield-sdk/issues)
- **Discord**: [Savvy Universe Discord](https://discord.gg/savvyuniverse)

## 🏆 **Savvy Universe Integration**

This SDK is part of the larger Savvy Universe ecosystem:

- **Cross-App Protection**: Unified fraud detection across all 30+ apps
- **Shared Intelligence**: Learnings from one app protect all apps
- **Unified Enforcement**: Consistent actions across the ecosystem
- **AI-Powered**: Machine learning improves over time

**"Provision without permission" - Building the future of fraud prevention!** 🚀🛡️💎






