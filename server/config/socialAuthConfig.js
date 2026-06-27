/**
 * Social OAuth (Google + Apple) configuration, read from environment.
 *
 * Providers are only advertised/enabled when ALL required values are present,
 * so the UI can hide buttons that aren't configured yet (e.g. Apple before the
 * Apple Developer setup is complete). See docs/SOCIAL_AUTH_SETUP.md.
 */

const { FINAL10_APP_URL, isNonPublicLinkUrl } = require('./final10Branding');

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

/** Safe startup report — names only, never secret values. */
function getOAuthStartupReport() {
  const googleVars = {
    GOOGLE_CLIENT_ID: Boolean(google.clientId),
    GOOGLE_CLIENT_SECRET: Boolean(google.clientSecret),
    GOOGLE_CALLBACK_URL: Boolean(google.callbackUrl),
  };
  const appleVars = {
    APPLE_CLIENT_ID: Boolean(apple.clientId),
    APPLE_TEAM_ID: Boolean(apple.teamId),
    APPLE_KEY_ID: Boolean(apple.keyId),
    APPLE_PRIVATE_KEY: Boolean(apple.privateKey),
    APPLE_CALLBACK_URL: Boolean(apple.callbackUrl),
  };
  const googleMissing = Object.entries(googleVars)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  const appleMissing = Object.entries(appleVars)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);

  const clientUrlRaw = clean(process.env.CLIENT_URL);
  const frontendUrlRaw = clean(process.env.FRONTEND_URL);

  return {
    google: {
      enabled: googleEnabled(),
      vars: googleVars,
      missing: googleMissing,
      callbackUrl: google.callbackUrl || null,
    },
    apple: {
      enabled: appleEnabled(),
      vars: appleVars,
      missing: appleMissing,
      callbackUrl: apple.callbackUrl || null,
    },
    clientRedirectBase: getClientBaseUrl(),
    redirectEnv: {
      CLIENT_URL: Boolean(clientUrlRaw),
      FRONTEND_URL: Boolean(frontendUrlRaw),
      CLIENT_URL_isPublic: clientUrlRaw ? !isNonPublicLinkUrl(clientUrlRaw) : false,
      FRONTEND_URL_isPublic: frontendUrlRaw ? !isNonPublicLinkUrl(frontendUrlRaw) : false,
    },
  };
}

/** Log OAuth readiness at server boot (Railway deploy logs). Never logs secrets. */
function logOAuthStartup() {
  const report = getOAuthStartupReport();
  console.log('[startup] OAuth configuration:');
  if (report.google.enabled) {
    console.log('  Google: enabled');
    console.log(`  Google callback URL: ${report.google.callbackUrl}`);
  } else {
    console.log(
      `  Google: disabled — missing env: ${report.google.missing.join(', ') || '(check values)'}`
    );
    if (report.google.callbackUrl) {
      console.log(`  Google callback URL (set): ${report.google.callbackUrl}`);
    } else {
      console.log('  Google callback URL (expected): https://api.final10.app/api/auth/google/callback');
    }
  }
  if (report.apple.enabled) {
    console.log('  Apple: enabled');
    console.log(`  Apple callback URL: ${report.apple.callbackUrl}`);
  } else {
    console.log(
      `  Apple: disabled — missing env: ${report.apple.missing.join(', ') || '(check values)'}`
    );
    if (report.apple.callbackUrl) {
      console.log(`  Apple callback URL (set): ${report.apple.callbackUrl}`);
    } else {
      console.log('  Apple callback URL (expected): https://api.final10.app/api/auth/apple/callback');
    }
  }
  console.log(`  OAuth post-login redirect base: ${report.clientRedirectBase}`);
  if (report.redirectEnv.CLIENT_URL && !report.redirectEnv.CLIENT_URL_isPublic) {
    console.warn(
      '  WARNING: CLIENT_URL is set but points at a non-public host (e.g. vercel.app). ' +
        'OAuth error/success redirects use https://final10.app instead.'
    );
  }
  if (!report.redirectEnv.CLIENT_URL && !report.redirectEnv.FRONTEND_URL) {
    console.warn(
      '  WARNING: CLIENT_URL and FRONTEND_URL are unset — OAuth redirects fall back to https://final10.app'
    );
  }
}

/**
 * Public app origin for OAuth redirects back to the React client.
 * Rejects preview/deploy infra URLs (vercel.app, railway.app, etc.) so a stale
 * Railway CLIENT_URL cannot send users to the wrong host.
 */
function getClientBaseUrl() {
  const configured =
    clean(process.env.CLIENT_URL) ||
    clean(process.env.FRONTEND_URL) ||
    clean(process.env.PUBLIC_APP_URL);
  if (configured && !isNonPublicLinkUrl(configured)) {
    return configured.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV !== 'production') {
    return configured ? configured.replace(/\/$/, '') : 'http://localhost:3000';
  }
  return FINAL10_APP_URL;
}

module.exports = {
  google,
  apple,
  googleEnabled,
  appleEnabled,
  getClientBaseUrl,
  getOAuthStartupReport,
  logOAuthStartup,
};
