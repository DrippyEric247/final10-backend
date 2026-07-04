const {
  oauthDisabledPayload,
  wantsJsonOAuthResponse,
  respondOAuthDisabled,
} = require('../lib/oauthRouteHelpers');

describe('oauthRouteHelpers', () => {
  it('builds disabled-provider JSON payload', () => {
    const payload = oauthDisabledPayload('google');
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe('GOOGLE_OAUTH_DISABLED');
    expect(payload.configured).toBe(false);
    expect(payload.message).toMatch(/email and password/i);
  });

  it('detects JSON preference from format=json', () => {
    const req = { query: { format: 'json' }, get: () => null };
    expect(wantsJsonOAuthResponse(req)).toBe(true);
  });

  it('respondOAuthDisabled returns JSON for XHR requests', () => {
    const req = { query: {}, get: (h) => (h === 'X-Requested-With' ? 'XMLHttpRequest' : null) };
    const json = jest.fn();
    const redirect = jest.fn();
    const res = { status: jest.fn(() => ({ json })), redirect };

    respondOAuthDisabled(req, res, 'google', () => 'http://example.com/login');

    expect(res.status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'GOOGLE_OAUTH_DISABLED' }));
    expect(redirect).not.toHaveBeenCalled();
  });
});
