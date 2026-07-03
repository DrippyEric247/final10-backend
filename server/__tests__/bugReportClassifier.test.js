const {
  classifyBugReport,
  PRIORITIES,
  APPS,
} = require('../services/bugReportClassifier');

describe('bugReportClassifier', () => {
  it('classifies launch blockers as P0', () => {
    const result = classifyBugReport({
      title: 'White screen on login',
      steps: '1. Open app 2. Tap login 3. White screen appears cannot login',
      expected: 'Login form loads',
      actual: 'Blank white screen, app crash',
      severity: 'high',
      page: '/login',
    });
    expect(result.priority.id).toBe('P0');
    expect(result.githubLabels).toContain('priority:p0');
  });

  it('detects final10 auctions subsystem', () => {
    const result = classifyBugReport({
      title: 'Stronger move modal cut off on mobile Safari',
      steps: 'Browse auctions on iPhone. Stronger move modal appears off-screen.',
      expected: 'Modal centered',
      actual: 'Modal clipped at top',
      severity: 'med',
      page: '/auctions',
      userAgent: 'Mozilla/5.0 iPhone Safari',
    });
    expect(result.app.id).toBe('final10');
    expect(result.subsystems).toEqual(expect.arrayContaining(['ui', 'mobile', 'search']));
    expect(result.filesLikelyInvolved.some((f) => f.includes('Auctions'))).toBe(true);
  });

  it('detects stripe/payments for donation failures', () => {
    const result = classifyBugReport({
      title: 'Stripe payment link fails',
      steps: 'Click donation button. Stripe checkout shows error.',
      expected: 'Checkout opens',
      actual: 'Stripe error webhook failed',
      severity: 'high',
      page: '/',
    });
    expect(result.subsystems).toEqual(expect.arrayContaining(['stripe', 'payments']));
    expect(result.priority.id).toMatch(/P0|P1/);
  });

  it('classifies cosmetic issues as P3', () => {
    const result = classifyBugReport({
      title: 'Minor typo on profile',
      steps: 'Open profile and see cosmetic alignment issue',
      expected: 'Aligned text',
      actual: 'Slight spacing typo',
      severity: 'low',
      page: '/profile',
    });
    expect(result.priority.id).toBe('P3');
  });

  it('includes actionable AI metadata fields', () => {
    const result = classifyBugReport({
      title: 'Perk Machine spin stuck',
      steps: 'Spin perk machine twice. Second spin hangs.',
      expected: 'Spin completes',
      actual: 'Loading forever',
      severity: 'med',
      page: '/perk-machine',
    });
    expect(result.summary).toContain('Perk Machine');
    expect(result.rootCauseHypothesis.length).toBeGreaterThan(20);
    expect(result.suggestedFix.length).toBeGreaterThan(20);
    expect(result.regressionTests.length).toBeGreaterThan(0);
    expect(result.githubLabels).toEqual(
      expect.arrayContaining(['bug', 'triage:ai', 'app:final10', 'perks'])
    );
  });

  it('maps shared auth issues to shared-platform', () => {
    const result = classifyBugReport({
      title: 'API auth middleware rejects valid token',
      steps: 'Call /api/auth/me with bearer token from mobile app',
      expected: '200 user payload',
      actual: '401 unauthorized',
      severity: 'high',
      page: '/api/auth',
    });
    expect(result.app.id).toBe('shared-platform');
    expect(result.subsystems).toContain('auth');
  });

  it('exports priority and app catalogs', () => {
    expect(PRIORITIES.P2.label).toContain('P2');
    expect(APPS.final10.id).toBe('final10');
  });
});
