const {
  peekLiveScanBudget,
  recordLiveScanSuccess,
  resetMarketplaceScanBucketsForTests,
} = require('../middleware/marketplaceScanLimiter');

describe('marketplaceScanLimiter', () => {
  const prev = process.env.BETA_MODE;

  beforeEach(() => {
    resetMarketplaceScanBucketsForTests();
    process.env.BETA_MODE = 'true';
  });

  afterEach(() => {
    resetMarketplaceScanBucketsForTests();
    if (prev === undefined) delete process.env.BETA_MODE;
    else process.env.BETA_MODE = prev;
  });

  test('does not count failed or empty scans', () => {
    const req = { ip: '1.2.3.4', user: { _id: 'u1' } };
    recordLiveScanSuccess(req, { liveExternal: false, mock: false, itemCount: 5 });
    recordLiveScanSuccess(req, { liveExternal: true, mock: true, itemCount: 5 });
    recordLiveScanSuccess(req, { liveExternal: true, mock: false, itemCount: 0 });
    expect(peekLiveScanBudget(req).count).toBe(0);
  });

  test('counts only successful live external scans with results', () => {
    const req = { ip: '9.9.9.9', user: { _id: 'u2' } };
    recordLiveScanSuccess(req, { liveExternal: true, mock: false, itemCount: 3 });
    expect(peekLiveScanBudget(req).count).toBe(1);
    recordLiveScanSuccess(req, { liveExternal: true, mock: false, itemCount: 1 });
    expect(peekLiveScanBudget(req).count).toBe(2);
  });
});
