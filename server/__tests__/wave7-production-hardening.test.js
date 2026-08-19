/**
 * Wave 7 — production hardening tests (no Mongo required).
 */

const { requestIdMiddleware, REQUEST_ID_HEADER } = require('../middleware/requestId');
const { productionRequiredNames, SERVER_ENV_REGISTRY } = require('../config/envRegistry');
const { looksLikePlaceholder } = require('../config/envValidation');

describe('Wave 7 — request correlation IDs', () => {
  function mockReqRes(headers = {}) {
    const req = { headers, originalUrl: '/api/test', method: 'GET' };
    const res = { setHeader: jest.fn() };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    requestIdMiddleware(req, res, next);
    return { req, res, nextCalled };
  }

  it('generates a server-side request ID when header absent', () => {
    const { req, res, nextCalled } = mockReqRes();
    expect(nextCalled).toBe(true);
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.requestId);
  });

  it('accepts safe incoming X-Request-Id', () => {
    const { req } = mockReqRes({ 'x-request-id': 'trace-abc-123' });
    expect(req.requestId).toBe('trace-abc-123');
  });

  it('rejects unsafe incoming IDs', () => {
    const { req } = mockReqRes({ 'x-request-id': 'bad id with spaces' });
    expect(req.requestId).not.toBe('bad id with spaces');
    expect(req.requestId.length).toBeGreaterThan(10);
  });
});

describe('Wave 7 — environment registry', () => {
  it('lists production-required server secrets', () => {
    const required = productionRequiredNames();
    expect(required).toContain('JWT_SECRET');
    expect(required).toContain('MONGODB_URI');
  });

  it('registry entries never embed secret values', () => {
    for (const row of SERVER_ENV_REGISTRY) {
      expect(row).not.toHaveProperty('value');
      expect(row.name).toBeTruthy();
    }
  });
});

describe('Wave 7 — placeholder detection', () => {
  it('flags common placeholder patterns', () => {
    expect(looksLikePlaceholder('supersecretchangeme')).toBe(true);
    expect(looksLikePlaceholder('sk-your_key_here')).toBe(true);
    expect(looksLikePlaceholder('a'.repeat(40))).toBe(false);
  });
});

describe('Wave 7 — error handler includes requestId', () => {
  it('error responses include requestId when present on req', () => {
    const { errorHandler } = require('../middleware/errorHandler');
    const req = { originalUrl: '/api/x', method: 'GET', requestId: 'req-test-1', headers: {} };
    const res = {
      headersSent: false,
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
    };
    errorHandler(new Error('boom'), req, res, () => {});
    expect(res.body.requestId).toBe('req-test-1');
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});

describe('Wave 7 — scanner route hardening', () => {
  it('generate-sample-data route blocks production via isProduction guard', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../routes/scanner.js'), 'utf8');
    expect(src).toMatch(/generate-sample-data.*requireAdminAccess/s);
    expect(src).toMatch(/isProduction\(\)/);
    expect(src).not.toMatch(/generate-sample-data',\s*async \(req, res\) => \{\s*try \{\s*const Auction/);
  });
});

describe('Wave 7 — shield admin route imports User model', () => {
  it('shield.js imports User for requireShieldAdmin', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../routes/shield.js'), 'utf8');
    expect(src).toMatch(/const User = require\('\.\.\/models\/User'\)/);
  });
});

describe('Wave 7 — health endpoint aliases', () => {
  it('index.js exposes /health and /ready aliases', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../index.js'), 'utf8');
    expect(src).toMatch(/app\.get\('\/health'/);
    expect(src).toMatch(/app\.get\('\/ready'/);
    expect(src).toMatch(/payload\.ok \? 200 : 503/);
  });
});
