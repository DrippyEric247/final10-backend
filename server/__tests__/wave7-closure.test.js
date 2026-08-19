/**
 * Wave 7 closure — distributed locks, rate limits, secrets, errors, email retry, indexes.
 */

const mongoose = require('mongoose');
const {
  validateShieldWebhookSecretAtBoot,
  getShieldWebhookSecret,
} = require('../lib/shieldWebhookSecret');
const {
  acquireJobLease,
  releaseJobLease,
  withJobLease,
} = require('../lib/distributedJobLock');
const { incrementDistributedRateLimit, windowStartFor } = require('../lib/distributedRateLimit');
const {
  scheduleEmailRetry,
  computeNextAttemptAt,
  MAX_EMAIL_RETRIES,
  PERMANENT_FAILURE_REASONS,
} = require('../services/alertEmailRetryService');
const { INDEX_MANIFEST, verifyAndEnsureIndexes, specKey } = require('../lib/indexDeployment');
const { HttpError } = require('../middleware/apiErrors');
const { errorHandler } = require('../middleware/errorHandler');
const { sendApiError } = require('../middleware/apiResponse');
const { RATE_LIMIT_CLASSIFICATION } = require('../lib/rateLimitClassification');
const BackgroundJobLease = require('../models/BackgroundJobLease');
const DistributedRateLimitBucket = require('../models/DistributedRateLimitBucket');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Auction = require('../models/Auction');

const MONGODB_URI = process.env.MONGODB_URI || '';
const describeReal = MONGODB_URI ? describe : describe.skip;

function mockRes() {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader() {},
  };
  return res;
}

describe('Wave 7 closure — secret boot (unit)', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('production fails closed when Shield secret missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SHIELD_WEBHOOK_SECRET;
    delete process.env.SHIELD_WEBHOOK_ENABLED;
    expect(() => validateShieldWebhookSecretAtBoot()).toThrow(/SHIELD_WEBHOOK_SECRET/);
  });

  it('production rejects default_secret placeholder', () => {
    process.env.NODE_ENV = 'production';
    process.env.SHIELD_WEBHOOK_SECRET = 'default_secret';
    expect(() => validateShieldWebhookSecretAtBoot()).toThrow(/placeholder|default_secret/);
  });

  it('test/dev allows explicit secret without logging it', () => {
    process.env.NODE_ENV = 'test';
    process.env.SHIELD_WEBHOOK_SECRET = 'wave7-test-shield-secret-not-default';
    expect(() => validateShieldWebhookSecretAtBoot()).not.toThrow();
    expect(getShieldWebhookSecret()).toBe('wave7-test-shield-secret-not-default');
  });

  it('no default_secret fallback remains in Shield paths', () => {
    const enforcement = require('fs').readFileSync(
      require('path').join(__dirname, '../routes/shieldEnforcement.js'),
      'utf8'
    );
    const engine = require('fs').readFileSync(
      require('path').join(__dirname, '../services/shieldDecisionEngine.js'),
      'utf8'
    );
    expect(enforcement).not.toMatch(/default_secret/);
    expect(engine).not.toMatch(/default_secret/);
    expect(enforcement).toMatch(/getShieldWebhookSecret/);
  });
});

describe('Wave 7 closure — error contract (unit)', () => {
  it('errorHandler returns code, message, requestId without stack', () => {
    const req = { originalUrl: '/api/test', method: 'POST', requestId: 'req-abc', headers: {} };
    const res = mockRes();
    process.env.NODE_ENV = 'production';
    errorHandler(new Error('db connection secret leaked'), req, res, () => {});
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.body.message).toBe('Request could not be completed.');
    expect(res.body.requestId).toBe('req-abc');
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/secret leaked/);
  });

  it('HttpError statuses map to canonical shape', () => {
    const cases = [
      [400, 'VALIDATION_FAILED', 'Bad input'],
      [401, 'UNAUTHORIZED', 'Login required'],
      [403, 'FORBIDDEN', 'Not allowed'],
      [404, 'NOT_FOUND', 'Missing'],
      [409, 'CONFLICT', 'Duplicate'],
      [429, 'RATE_LIMIT', 'Slow down'],
      [503, 'SERVICE_UNAVAILABLE', 'Dependency down'],
    ];
    for (const [status, code, message] of cases) {
      const req = { requestId: 'rid-1', headers: {} };
      const res = mockRes();
      errorHandler(new HttpError(status, code, message), req, res, () => {});
      expect(res.statusCode).toBe(status);
      expect(res.body).toEqual({ code, message, requestId: 'rid-1' });
    }
  });

  it('sendApiError helper includes requestId', () => {
    const req = { requestId: 'req-send-1' };
    const res = mockRes();
    sendApiError(res, req, 422, 'INVALID_PAYLOAD', 'Invalid payload');
    expect(res.body).toEqual({
      code: 'INVALID_PAYLOAD',
      message: 'Invalid payload',
      requestId: 'req-send-1',
    });
  });
});

describe('Wave 7 closure — email retry (unit)', () => {
  it('temporary failure schedules retry with backoff', () => {
    const patch = scheduleEmailRetry({ emailRetryCount: 0 }, 'send_failed');
    expect(patch.emailDeliveryStatus).toBe('retry');
    expect(patch.emailRetryCount).toBe(1);
    expect(patch.emailNextAttemptAt).toBeInstanceOf(Date);
  });

  it('permanent recipient failures terminate without retry', () => {
    for (const reason of PERMANENT_FAILURE_REASONS) {
      const patch = scheduleEmailRetry({ emailRetryCount: 0 }, reason);
      expect(patch.emailDeliveryStatus).toBe('failed');
      expect(patch.emailNextAttemptAt).toBeNull();
    }
  });

  it('max retries terminates', () => {
    const patch = scheduleEmailRetry({ emailRetryCount: MAX_EMAIL_RETRIES }, 'send_failed');
    expect(patch.emailDeliveryStatus).toBe('failed');
    expect(patch.emailFailureReason).toBe('max_retries_exceeded');
  });

  it('backoff grows with retry count', () => {
    const a = computeNextAttemptAt(1).getTime();
    const b = computeNextAttemptAt(3).getTime();
    expect(b - Date.now()).toBeGreaterThan(a - Date.now());
  });
});

describe('Wave 7 closure — index deployment (unit)', () => {
  it('manifest lists Wave 1–7 critical indexes', () => {
    const names = INDEX_MANIFEST.map((e) => e.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'alert_scan_schedule',
        'savvy_tx_idempotency',
        'user_email',
        'job_lease_expires',
        'alert_email_retry',
      ])
    );
  });

  it('specKey is stable for index comparison', () => {
    expect(specKey({ userId: 1, createdAt: -1 })).toBe(
      specKey({ userId: 1, createdAt: -1 })
    );
  });

  it('dry-run reports structure without requiring apply', () => {
    expect(INDEX_MANIFEST.length).toBeGreaterThan(5);
    expect(typeof verifyAndEnsureIndexes).toBe('function');
  });
});

describeReal('Wave 7 closure — index preflight integration (Mongo)', () => {
  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
  }, 30000);

  it('dry-run verify returns ok/existing/created arrays', async () => {
    const report = await verifyAndEnsureIndexes({ dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(Array.isArray(report.existing)).toBe(true);
    expect(Array.isArray(report.created)).toBe(true);
    expect(typeof report.ok).toBe('boolean');
  });
});

describe('Wave 7 closure — rate limit classification (unit)', () => {
  it('documents SECURITY vs ABUSE vs PRODUCT_QUOTA', () => {
    expect(RATE_LIMIT_CLASSIFICATION.authLoginLimiter).toBe('SECURITY');
    expect(RATE_LIMIT_CLASSIFICATION.globalApiLimiter).toBe('ABUSE');
    expect(RATE_LIMIT_CLASSIFICATION.marketValueLimiter).toBe('PRODUCT_QUOTA');
    expect(RATE_LIMIT_CLASSIFICATION.alertMutationLimiter).toBe('SECURITY');
  });
});

describeReal('Wave 7 closure — distributed job lease (Mongo)', () => {
  const jobKey = `test:job:${Date.now()}`;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  }, 60000);

  afterAll(async () => {
    await BackgroundJobLease.deleteMany({ jobKey: /^test:job:/ });
    await mongoose.disconnect();
  }, 30000);

  beforeEach(async () => {
    await BackgroundJobLease.deleteMany({ jobKey });
  });

  it('only one instance acquires active lease', async () => {
    const a = await acquireJobLease(jobKey, 'owner-a', 5000);
    const b = await acquireJobLease(jobKey, 'owner-b', 5000);
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(false);
    expect(b.reason).toBe('held_by_other');
    await releaseJobLease(jobKey, 'owner-a');
  });

  it('expired lease can be stolen atomically', async () => {
    await BackgroundJobLease.create({
      jobKey,
      ownerId: 'stale-owner',
      expiresAt: new Date(Date.now() - 1000),
    });
    const recovered = await acquireJobLease(jobKey, 'owner-new', 5000);
    expect(recovered.acquired).toBe(true);
    expect(recovered.recovered).toBe(true);
    await releaseJobLease(jobKey, 'owner-new');
  });

  it('withJobLease skips overlapping execution', async () => {
    let runs = 0;
    const slow = withJobLease(
      jobKey,
      () =>
        new Promise((resolve) => {
          runs += 1;
          setTimeout(resolve, 200);
        }),
      { ownerId: 'worker-1', leaseMs: 5000 }
    );
    const blocked = withJobLease(jobKey, async () => {
      runs += 1;
    }, { ownerId: 'worker-2', leaseMs: 5000 });
    const [r1, r2] = await Promise.all([slow, blocked]);
    expect(r1.skipped).toBe(false);
    expect(r2.skipped).toBe(true);
    expect(runs).toBe(1);
  });
});

describeReal('Wave 7 closure — distributed rate limit (Mongo)', () => {
  const bucketBase = `test:rl:${Date.now()}`;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
  }, 60000);

  afterAll(async () => {
    await DistributedRateLimitBucket.deleteMany({ bucketKey: new RegExp(`^SECURITY:testRate:${bucketBase}`) });
    await mongoose.disconnect();
  }, 30000);

  it('shared bucket enforces limit across logical replicas', async () => {
    const key = `SECURITY:testRate:${bucketBase}:1.2.3.4`;
    const windowMs = 60000;
    const r1 = await incrementDistributedRateLimit(key, 2, windowMs);
    const r2 = await incrementDistributedRateLimit(key, 2, windowMs);
    const r3 = await incrementDistributedRateLimit(key, 2, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.count).toBe(3);
  });

  it('windowStartFor aligns counters to window boundary', () => {
    const ws = windowStartFor(1_700_000_123_456, 60000);
    expect(ws.getTime() % 60000).toBe(0);
  });
});

describeReal('Wave 7 closure — alert email retry idempotency (Mongo)', () => {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  let user;
  let alert;
  let auction;

  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI);
    user = await User.create({
      username: `w7_${suffix}`,
      email: `w7_${suffix}@test.local`,
      alertEmailOnMatch: true,
      savvyPoints: 0,
      subscription: { tier: 'free' },
    });
    auction = await Auction.create({
      title: `Test auction ${suffix}`,
      description: 'Wave 7 closure test fixture',
      category: 'electronics',
      condition: 'good',
      startingPrice: 100,
      currentBid: 100,
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() + 3600000),
      source: { platform: 'ebay', url: 'https://example.com/item' },
    });
    alert = await Alert.create({
      user: user._id,
      name: 'Test alert',
      keywords: ['test'],
      isActive: true,
      matches: [
        {
          auction: auction._id,
          emailSentAt: null,
          emailDeliveryStatus: 'retry',
          emailRetryCount: 1,
          emailNextAttemptAt: new Date(Date.now() - 1000),
        },
      ],
    });
  }, 60000);

  afterAll(async () => {
    if (!MONGODB_URI) return;
    await Alert.deleteMany({ user: user?._id });
    await Auction.deleteMany({ _id: auction?._id });
    await User.deleteOne({ _id: user?._id });
    await mongoose.disconnect();
  }, 30000);

  it('retry worker skips already-sent matches', async () => {
    const { retrySingleMatchEmail } = require('../services/alertEmailRetryService');
    const match = alert.matches[0];
    await Alert.updateOne(
      { _id: alert._id, 'matches._id': match._id },
      { $set: { 'matches.$.emailSentAt': new Date(), 'matches.$.emailDeliveryStatus': 'sent' } }
    );
    const refreshed = await Alert.findById(alert._id);
    const result = await retrySingleMatchEmail(refreshed, refreshed.matches[0]);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('already_sent');
  });
});
