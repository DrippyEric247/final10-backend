const {
  buildAllowedOrigins,
  isOriginAllowed,
  resolveCorsOrigin,
  isVercelAppOrigin,
  isLocalDevOrigin,
  useCorsCredentials,
  createOptionsPreflightMiddleware,
  FINAL10_PRODUCTION_ORIGINS,
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

  it('allows Vercel preview deployments in non-production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_VERCEL_PREVIEW_CORS;
    expect(isVercelAppOrigin('https://final10-client-git-beta-drippy.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://final10-client-git-beta-drippy.vercel.app')).toBe(true);
  });

  it('blocks Vercel previews in production unless ALLOW_VERCEL_PREVIEW_CORS=1', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_VERCEL_PREVIEW_CORS;
    expect(isVercelAppOrigin('https://final10-abc123.vercel.app')).toBe(false);
    expect(isOriginAllowed('https://final10-abc123.vercel.app')).toBe(false);

    process.env.ALLOW_VERCEL_PREVIEW_CORS = '1';
    expect(isVercelAppOrigin('https://final10-abc123.vercel.app')).toBe(true);
    expect(isOriginAllowed('https://final10-abc123.vercel.app')).toBe(true);
  });

  it('blocks unknown origins', () => {
    expect(isOriginAllowed('https://evil.example.com')).toBe(false);
    expect(resolveCorsOrigin('https://evil.example.com')).toBeNull();
  });

  it('parses ALLOWED_ORIGINS with both apex and www while CLIENT_URL stays apex', () => {
    process.env.CLIENT_URL = 'https://final10.app';
    process.env.ALLOWED_ORIGINS = 'https://final10.app,https://www.final10.app';
    const allowed = buildAllowedOrigins();
    expect(allowed.has('https://final10.app')).toBe(true);
    expect(allowed.has('https://www.final10.app')).toBe(true);
    FINAL10_PRODUCTION_ORIGINS.forEach((o) => expect(allowed.has(o)).toBe(true));
  });

  it('OPTIONS preflight returns 204 for allowed final10.app API paths', () => {
    const preflight = createOptionsPreflightMiddleware();
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader(key, value) {
        headers[key] = value;
      },
      sendStatus(code) {
        this.statusCode = code;
        return this;
      },
    };
    const req = {
      method: 'OPTIONS',
      headers: {
        origin: 'https://www.final10.app',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
      path: '/api/auth/login',
    };

    let nextCalled = false;
    preflight(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(204);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://www.final10.app');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
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
