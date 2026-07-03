import { rateLimitBackoffMs, RATE_LIMIT_MAX_ATTEMPTS } from '../apiRateLimitBackoff';
import { userSafeErrorMessage } from '../apiErrorParsing';
import { SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE } from '../savvyScoutRateLimitCopy';

describe('apiRateLimitBackoff', () => {
  it('exponential backoff grows with attempts', () => {
    const a0 = rateLimitBackoffMs(0, 0);
    const a2 = rateLimitBackoffMs(2, 0);
    expect(a2).toBeGreaterThan(a0);
  });

  it('respects server retry-after floor', () => {
    expect(rateLimitBackoffMs(0, 30)).toBeGreaterThanOrEqual(30000);
  });

  it('caps max attempts constant', () => {
    expect(RATE_LIMIT_MAX_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });
});

describe('userSafeErrorMessage rate limits', () => {
  it('returns Savvy Scout copy for 429', () => {
    expect(userSafeErrorMessage({ status: 429 })).toBe(SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE);
  });

  it('sanitizes raw rate limit API strings', () => {
    expect(userSafeErrorMessage({ message: 'Rate limited — GET /api/foo' })).toBe(
      SAVVY_SCOUT_RATE_LIMIT_USER_MESSAGE
    );
  });
});
