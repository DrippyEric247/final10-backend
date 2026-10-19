/**
 * OAuth return origins must be the initiating allowlisted app.
 * Unlisted origins are dropped so the callback cannot become an open redirect.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'oauth-return-test-secret-32chars!!';
process.env.NODE_ENV = 'production';
delete process.env.CLIENT_URL;
delete process.env.FRONTEND_URL;
delete process.env.PUBLIC_APP_URL;

const jwt = require('jsonwebtoken');
const {
  getGoogleAuthUrl,
  buildClientSuccessRedirect,
  buildClientErrorRedirect,
  clientOriginFromOAuthState,
} = require('../services/socialAuthService');

function statePayload(authUrl) {
  const state = new URL(authUrl).searchParams.get('state');
  return jwt.verify(state, process.env.JWT_SECRET);
}

describe('OAuth return origin', () => {
  it('stores EyeSpySavvy and sends success there on /auth/callback', () => {
    const payload = statePayload(getGoogleAuthUrl({ clientOrigin: 'https://www.eyespysavvy.app' }));
    expect(payload.clientOrigin).toBe('https://www.eyespysavvy.app');
    expect(payload.k).toBe('oauth_state');
    expect(payload.provider).toBe('google');

    const redirect = new URL(
      buildClientSuccessRedirect('session-token', 'google', payload.clientOrigin)
    );
    expect(redirect.origin).toBe('https://www.eyespysavvy.app');
    expect(redirect.pathname).toBe('/auth/callback');
    expect(redirect.protocol).toBe('https:');
  });

  it('sends the EyeSpySavvy apex origin to the canonical www host', () => {
    const payload = statePayload(getGoogleAuthUrl({ clientOrigin: 'https://eyespysavvy.app/' }));
    expect(payload.clientOrigin).toBe('https://www.eyespysavvy.app');
    const redirect = new URL(
      buildClientSuccessRedirect('session-token', 'google', 'https://eyespysavvy.app')
    );
    expect(redirect.origin).toBe('https://www.eyespysavvy.app');
    expect(redirect.pathname).toBe('/auth/callback');
  });

  it('keeps SavvyTrip on the host that started sign-in', () => {
    for (const origin of ['https://savvytrip.app', 'https://www.savvytrip.app']) {
      const payload = statePayload(getGoogleAuthUrl({ clientOrigin: origin }));
      expect(payload.clientOrigin).toBe(origin);
      const redirect = new URL(buildClientSuccessRedirect('session-token', 'google', origin));
      expect(redirect.origin).toBe(origin);
      expect(redirect.pathname).toBe('/auth/callback');
    }
  });

  it('keeps Final10 on its own callback path', () => {
    const payload = statePayload(getGoogleAuthUrl({ clientOrigin: 'https://www.final10.app' }));
    expect(payload.clientOrigin).toBe('https://www.final10.app');
    const redirect = new URL(
      buildClientSuccessRedirect('session-token', 'google', payload.clientOrigin)
    );
    expect(redirect.origin).toBe('https://www.final10.app');
    expect(redirect.pathname).toBe('/auth/social');
  });

  it('drops an unlisted origin and does not redirect there', () => {
    const payload = statePayload(getGoogleAuthUrl({ clientOrigin: 'https://evil.example/phish' }));
    expect(payload.clientOrigin).toBeUndefined();
    const redirect = buildClientSuccessRedirect('session-token', 'google', 'https://evil.example');
    expect(redirect.startsWith('https://evil.example')).toBe(false);
    expect(new URL(redirect).origin).toBe('https://final10.app');
  });

  it('sends a cancelled EyeSpySavvy login back to that login page', () => {
    const payload = statePayload(getGoogleAuthUrl({ clientOrigin: 'https://www.eyespysavvy.app' }));
    const state = jwt.sign(payload, process.env.JWT_SECRET);
    expect(clientOriginFromOAuthState(state, 'google')).toBe('https://www.eyespysavvy.app');
    const redirect = new URL(
      buildClientErrorRedirect('cancelled', 'google', clientOriginFromOAuthState(state, 'google'))
    );
    expect(redirect.origin).toBe('https://www.eyespysavvy.app');
    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('error')).toBe('cancelled');
  });

  it('ignores a state token for the wrong provider or a bad signature', () => {
    const payload = statePayload(getGoogleAuthUrl({ clientOrigin: 'https://www.eyespysavvy.app' }));
    const state = jwt.sign(payload, process.env.JWT_SECRET);
    expect(clientOriginFromOAuthState(state, 'apple')).toBeNull();
    expect(clientOriginFromOAuthState(`${state}x`, 'google')).toBeNull();
    expect(clientOriginFromOAuthState(null, 'google')).toBeNull();
  });
});
