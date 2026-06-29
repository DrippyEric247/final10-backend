const { shouldBypassRateLimits, rateLimitSkipDev } = require('../lib/rateLimitDevBypass');

describe('rateLimitDevBypass', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('bypasses in development by default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.F10_DISABLE_RATE_LIMIT_BYPASS;
    expect(shouldBypassRateLimits()).toBe(true);
    expect(rateLimitSkipDev({}, {})).toBe(true);
  });

  it('never bypasses in production', () => {
    process.env.NODE_ENV = 'production';
    expect(shouldBypassRateLimits()).toBe(false);
    expect(rateLimitSkipDev({}, {})).toBe(false);
  });

  it('can disable bypass locally via F10_DISABLE_RATE_LIMIT_BYPASS=1', () => {
    process.env.NODE_ENV = 'development';
    process.env.F10_DISABLE_RATE_LIMIT_BYPASS = '1';
    expect(shouldBypassRateLimits()).toBe(false);
  });
});
