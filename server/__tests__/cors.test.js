const {
  buildAllowedOrigins,
  isOriginAllowed,
  resolveCorsOrigin,
  isVercelAppOrigin,
  isLocalDevOrigin,
  useCorsCredentials,
} = require('../middleware/cors');

describe('CORS middleware', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it('allows final10.app and www', () => {
    expect(isOriginAllowed('https://final10.app')).toBe(true);
    expect(isOriginAllowed('https://www.final10.app')).toBe(true);
    expect(resolveCorsOrigin('https://www.final10.app')).toBe('https://www.final10.app');
  });

  it('allows localhost on any dev port', () => {
    expect(isLocalDevOrigin('http://localhost:3000')).toBe(true);
    expect(isLocalDevOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isOriginAllowed('http://localhost:4173')).toBe(true);
  });

  it('allows Vercel preview deployments (*.vercel.app)', () => {
    expect(isVercelAppOrigin('https://final10-client-git-beta-drippy.vercel.app')).toBe(true);
    expect(isVercelAppOrigin('https://final10-abc123.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://final10-client-git-beta-drippy.vercel.app')).toBe(true);
  });

  it('blocks unknown origins', () => {
    expect(isOriginAllowed('https://evil.example.com')).toBe(false);
    expect(resolveCorsOrigin('https://evil.example.com')).toBeNull();
  });

  it('parses ALLOWED_ORIGINS and expands www/apex from CLIENT_URL', () => {
    process.env.CLIENT_URL = 'https://final10.app';
    process.env.ALLOWED_ORIGINS = 'https://custom.example.com';
    const allowed = buildAllowedOrigins();
    expect(allowed.has('https://final10.app')).toBe(true);
    expect(allowed.has('https://www.final10.app')).toBe(true);
    expect(allowed.has('https://custom.example.com')).toBe(true);
  });

  it('does not enable credentials by default', () => {
    delete process.env.CORS_CREDENTIALS;
    expect(useCorsCredentials()).toBe(false);
  });

  it('enables credentials only when CORS_CREDENTIALS=true', () => {
    process.env.CORS_CREDENTIALS = 'true';
    expect(useCorsCredentials()).toBe(true);
  });

  it('strips trailing slash from origins', () => {
    expect(resolveCorsOrigin('https://final10.app/')).toBe('https://final10.app');
  });
});
