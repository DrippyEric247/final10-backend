const { googleEnabled, appleEnabled } = require('../config/socialAuthConfig');

/** Max wait for Google/Apple token exchange + JWKS verification. */
const OAUTH_EXTERNAL_TIMEOUT_MS = 12_000;

function providerEnabled(provider) {
  return provider === 'apple' ? appleEnabled() : googleEnabled();
}

function wantsJsonOAuthResponse(req) {
  if (String(req.query?.format || '').toLowerCase() === 'json') return true;
  if (String(req.get('X-Requested-With') || '').toLowerCase() === 'xmlhttprequest') return true;
  const accept = String(req.get('Accept') || '');
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;
  return false;
}

function oauthDisabledPayload(provider) {
  const code = `${String(provider || 'oauth').toUpperCase()}_OAUTH_DISABLED`;
  return {
    ok: false,
    code,
    message: `${provider === 'apple' ? 'Apple' : 'Google'} sign-in is not configured on this server. Use email and password to log in.`,
    provider,
    configured: false,
  };
}

/**
 * Respond when a social provider is not fully configured (missing env vars).
 * Browser navigations redirect to the client login page; API/XHR gets JSON.
 */
function respondOAuthDisabled(req, res, provider, buildClientErrorRedirect) {
  if (wantsJsonOAuthResponse(req)) {
    return res.status(503).json(oauthDisabledPayload(provider));
  }
  return res.redirect(buildClientErrorRedirect(`${provider}_not_configured`, provider));
}

/**
 * Wrap async OAuth route handlers so external provider calls cannot hang the worker.
 */
function wrapOAuthHandler(handler, { label = 'oauth_handler', timeoutMs = OAUTH_EXTERNAL_TIMEOUT_MS } = {}) {
  return async (req, res, next) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished || res.headersSent) return;
      finished = true;
      console.error(`[${label}] timed out after ${timeoutMs}ms`, {
        method: req.method,
        path: req.originalUrl || req.url,
      });
      if (!res.headersSent) {
        res.status(504).json({
          ok: false,
          code: 'OAUTH_TIMEOUT',
          message: 'Sign-in provider took too long to respond. Try again or use email/password login.',
        });
      }
    }, timeoutMs);

    try {
      await handler(req, res, next);
      finished = true;
    } catch (err) {
      finished = true;
      if (!res.headersSent) next(err);
    } finally {
      clearTimeout(timer);
    }
  };
}

module.exports = {
  OAUTH_EXTERNAL_TIMEOUT_MS,
  providerEnabled,
  wantsJsonOAuthResponse,
  oauthDisabledPayload,
  respondOAuthDisabled,
  wrapOAuthHandler,
};
