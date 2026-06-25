/**
 * Social OAuth (Google + Apple) configuration, read from environment.
 *
 * Providers are only advertised/enabled when ALL required values are present,
 * so the UI can hide buttons that aren't configured yet (e.g. Apple before the
 * Apple Developer setup is complete). See docs/SOCIAL_AUTH_SETUP.md.
 */

function clean(value) {
  return String(value || '').trim();
}

/** Apple private keys are frequently stored with literal "\n" — normalize to real newlines. */
function normalizePrivateKey(value) {
  const raw = clean(value);
  if (!raw) return '';
  if (raw.includes('-----BEGIN')) return raw.replace(/\\n/g, '\n');
  // Allow a base64-encoded .p8 to be provided as a single line.
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.includes('-----BEGIN')) return decoded;
  } catch (_e) {
    /* fall through */
  }
  return raw.replace(/\\n/g, '\n');
}

const google = {
  clientId: clean(process.env.GOOGLE_CLIENT_ID),
  clientSecret: clean(process.env.GOOGLE_CLIENT_SECRET),
  callbackUrl: clean(process.env.GOOGLE_CALLBACK_URL),
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  issuers: ['https://accounts.google.com', 'accounts.google.com'],
  scope: 'openid email profile',
};

const apple = {
  clientId: clean(process.env.APPLE_CLIENT_ID),
  teamId: clean(process.env.APPLE_TEAM_ID),
  keyId: clean(process.env.APPLE_KEY_ID),
  privateKey: normalizePrivateKey(process.env.APPLE_PRIVATE_KEY),
  callbackUrl: clean(process.env.APPLE_CALLBACK_URL),
  authUrl: 'https://appleid.apple.com/auth/authorize',
  tokenUrl: 'https://appleid.apple.com/auth/token',
  jwksUri: 'https://appleid.apple.com/auth/keys',
  issuer: 'https://appleid.apple.com',
  scope: 'name email',
};

function googleEnabled() {
  return Boolean(google.clientId && google.clientSecret && google.callbackUrl);
}

function appleEnabled() {
  return Boolean(
    apple.clientId && apple.teamId && apple.keyId && apple.privateKey && apple.callbackUrl
  );
}

/**
 * Public app origin to redirect the browser back to after auth.
 * Unlike email links, redirecting to localhost in dev is desired, so we use the
 * configured client URL directly (with an official production fallback).
 */
function getClientBaseUrl() {
  const configured =
    clean(process.env.CLIENT_URL) ||
    clean(process.env.FRONTEND_URL) ||
    clean(process.env.PUBLIC_APP_URL);
  if (configured) return configured.replace(/\/$/, '');
  return process.env.NODE_ENV === 'production' ? 'https://final10.app' : 'http://localhost:3000';
}

module.exports = {
  google,
  apple,
  googleEnabled,
  appleEnabled,
  getClientBaseUrl,
};
