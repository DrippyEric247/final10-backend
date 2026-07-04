const {
  isBetaMode,
  hasBetaProAccess,
  getLiveScanCap,
  getRouteRateCaps,
} = require('../config/betaMode');

describe('betaMode config', () => {
  const prev = process.env.BETA_MODE;

  afterEach(() => {
    if (prev === undefined) delete process.env.BETA_MODE;
    else process.env.BETA_MODE = prev;
  });

  test('defaults to off', () => {
    delete process.env.BETA_MODE;
    expect(isBetaMode()).toBe(false);
    expect(getLiveScanCap()).toBe(90);
    expect(getRouteRateCaps().globalApi).toBe(100);
  });

  test('grants beta pro access to authenticated users when on', () => {
    process.env.BETA_MODE = 'true';
    expect(isBetaMode()).toBe(true);
    expect(hasBetaProAccess({ _id: 'abc' })).toBe(true);
    expect(hasBetaProAccess(null)).toBe(false);
    expect(getLiveScanCap()).toBe(480);
    expect(getRouteRateCaps().globalApi).toBe(4000);
  });
});
