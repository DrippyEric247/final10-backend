const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const { info, warn, error: logError } = require('./structuredLog');

let ebayAppToken = null;
let ebayTokenExpiresAt = 0;
let lastTokenFailureAt = 0;
let lastTokenFailureReason = null;
let lastSuccessfulScope = null;

const TOKEN_RETRY_ATTEMPTS = 3;
const TOKEN_RETRY_BASE_MS = 400;

const DEFAULT_SCOPES = [
  'https://api.ebay.com/oauth/api_scope/buy.browse',
  'https://api.ebay.com/oauth/api_scope/buy.item.feed',
  'https://api.ebay.com/oauth/api_scope',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskSecret(value) {
  const s = String(value || '').trim();
  if (!s) return '(unset)';
  if (s.length <= 8) return `${s.slice(0, 2)}…`;
  return `${s.slice(0, 6)}…${s.slice(-4)} (len ${s.length})`;
}

function resolveEbayEnv() {
  const raw = String(process.env.EBAY_ENV || 'production').trim().toLowerCase();
  if (raw === 'sandbox' || raw === 'sb') return 'sandbox';
  return 'production';
}

function getEbayOAuthConfig() {
  const env = resolveEbayEnv();
  const isSandbox = env === 'sandbox';
  return {
    env,
    isSandbox,
    identityUrl: isSandbox
      ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
      : 'https://api.ebay.com/identity/v1/oauth2/token',
    browseBase: isSandbox
      ? 'https://api.sandbox.ebay.com/buy/browse/v1'
      : 'https://api.ebay.com/buy/browse/v1',
    clientId: String(process.env.EBAY_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.EBAY_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.EBAY_REDIRECT_URI || '').trim(),
    configuredScope: String(process.env.EBAY_SCOPE || '').trim(),
  };
}

function getScopeCandidates(configuredScope) {
  const list = [...DEFAULT_SCOPES];
  if (configuredScope && !list.includes(configuredScope)) {
    list.push(configuredScope);
  }
  return list;
}

function parseTokenErrorBody(data, status) {
  if (!data || typeof data !== 'object') {
    return { status, message: `HTTP ${status}`, error: 'unknown', description: '' };
  }
  return {
    status,
    error: data.error || data.error_id || 'ebay_oauth_error',
    description:
      data.error_description ||
      data.errorMessage ||
      data.message ||
      (Array.isArray(data.errors) ? data.errors[0]?.message : '') ||
      '',
    message: data.error_description || data.message || `HTTP ${status}`,
  };
}

async function requestAppTokenForScope(config, scope, attempt) {
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope,
  });

  info('EBAY_TOKEN_REQUEST', {
    env: config.env,
    scope,
    attempt: attempt + 1,
    identityHost: new URL(config.identityUrl).host,
    clientId: maskSecret(config.clientId),
  });

  const res = await fetch(config.identityUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: String(text).slice(0, 500) };
  }

  if (!res.ok) {
    const parsed = parseTokenErrorBody(data, res.status);
    logError('EBAY_TOKEN_SCOPE_FAILED', {
      env: config.env,
      scope,
      attempt: attempt + 1,
      status: res.status,
      error: parsed.error,
      description: parsed.description,
    });
    const err = new Error(parsed.message || 'eBay token request failed');
    err.status = res.status;
    err.ebay = parsed;
    err.scope = scope;
    throw err;
  }

  if (!data?.access_token) {
    logError('EBAY_TOKEN_MISSING_ACCESS_TOKEN', {
      env: config.env,
      scope,
      status: res.status,
    });
    const err = new Error('eBay token response missing access_token');
    err.status = res.status;
    err.scope = scope;
    throw err;
  }

  return data;
}

/**
 * Obtain a client-credentials app token (cached). Returns null when credentials
 * are missing or all scopes/retries fail — callers should use mock Browse fallback.
 */
async function getEbayAppToken(options = {}) {
  const { forceRefresh = false } = options;
  const now = Date.now();

  if (!forceRefresh && ebayAppToken && now < ebayTokenExpiresAt - 60_000) {
    return ebayAppToken;
  }

  const config = getEbayOAuthConfig();

  if (!config.clientId || !config.clientSecret) {
    lastTokenFailureAt = now;
    lastTokenFailureReason = 'missing_credentials';
    warn('EBAY_TOKEN_SKIPPED', {
      reason: 'missing_credentials',
      env: config.env,
      hasClientId: Boolean(config.clientId),
      hasClientSecret: Boolean(config.clientSecret),
      hasRedirectUri: Boolean(config.redirectUri),
    });
    return null;
  }

  const scopes = getScopeCandidates(config.configuredScope);
  let lastErr = null;

  for (let attempt = 0; attempt < TOKEN_RETRY_ATTEMPTS; attempt += 1) {
    for (const scope of scopes) {
      try {
        const data = await requestAppTokenForScope(config, scope, attempt);
        ebayAppToken = data.access_token;
        ebayTokenExpiresAt = now + (Number(data.expires_in) || 7200) * 1000;
        lastTokenFailureAt = 0;
        lastTokenFailureReason = null;
        lastSuccessfulScope = scope;
        info('EBAY_TOKEN_OK', {
          env: config.env,
          scope,
          attempt: attempt + 1,
          expiresInSec: Number(data.expires_in) || 7200,
          clientId: maskSecret(config.clientId),
        });
        return ebayAppToken;
      } catch (err) {
        lastErr = err;
        const retryable =
          !err.status ||
          err.status >= 500 ||
          err.status === 429 ||
          err.status === 408;
        if (!retryable) {
          continue;
        }
      }
    }
    if (attempt < TOKEN_RETRY_ATTEMPTS - 1) {
      await sleep(TOKEN_RETRY_BASE_MS * 2 ** attempt);
    }
  }

  ebayAppToken = null;
  ebayTokenExpiresAt = 0;
  lastTokenFailureAt = now;
  lastTokenFailureReason =
    lastErr?.ebay?.description || lastErr?.message || 'all_scopes_failed';

  logError('EBAY_TOKEN_FAILED', {
    env: config.env,
    reason: lastTokenFailureReason,
    lastStatus: lastErr?.status,
    lastScope: lastErr?.scope,
    scopesTried: scopes,
    clientId: maskSecret(config.clientId),
    hasRedirectUri: Boolean(config.redirectUri),
    hint:
      config.env === 'production'
        ? 'Verify production EBAY_CLIENT_ID/SECRET in Railway match developer.ebay.com Production keys.'
        : 'Sandbox keys require EBAY_ENV=sandbox.',
  });

  return null;
}

function clearEbayAppTokenCache() {
  ebayAppToken = null;
  ebayTokenExpiresAt = 0;
}

function getEbayAuthStatus() {
  const config = getEbayOAuthConfig();
  const now = Date.now();
  return {
    env: config.env,
    browseBase: config.browseBase,
    credentialsConfigured: Boolean(config.clientId && config.clientSecret),
    redirectUriConfigured: Boolean(config.redirectUri),
    clientIdPreview: maskSecret(config.clientId),
    tokenCached: Boolean(ebayAppToken && now < ebayTokenExpiresAt - 60_000),
    tokenExpiresAt: ebayTokenExpiresAt || null,
    lastFailureAt: lastTokenFailureAt || null,
    lastFailureReason: lastTokenFailureReason,
    lastSuccessfulScope,
  };
}

/** Startup log — never prints secrets. */
function logEbayAuthStartupCheck() {
  const status = getEbayAuthStatus();
  info('EBAY_AUTH_STARTUP', status);
  if (!status.credentialsConfigured) {
    warn('EBAY_AUTH_STARTUP', {
      message:
        'EBAY_CLIENT_ID or EBAY_CLIENT_SECRET missing — Browse routes will use mock/trending fallback.',
    });
  }
  if (!status.redirectUriConfigured) {
    warn('EBAY_AUTH_STARTUP', {
      message:
        'EBAY_REDIRECT_URI unset — user OAuth connect flow may fail (app token unaffected).',
    });
  }
}

module.exports = {
  getEbayAppToken,
  getEbayOAuthConfig,
  getEbayAuthStatus,
  clearEbayAppTokenCache,
  logEbayAuthStartupCheck,
  resolveEbayEnv,
};
