/**
 * Legacy module — delegates to ebayAuthService (retries, sandbox env, structured logs).
 */
const {
  getEbayAppToken,
  getEbayAuthStatus,
  clearEbayAppTokenCache,
} = require('./ebayAuthService');

let authEnabled = true;

function resetAuthState() {
  clearEbayAppTokenCache();
  authEnabled = true;
}

async function getEbayAccessToken() {
  const token = await getEbayAppToken();
  if (!token) {
    authEnabled = false;
    return null;
  }
  authEnabled = true;
  return token;
}

function isAuthEnabled() {
  return authEnabled;
}

module.exports = {
  getEbayAccessToken,
  getEbayAppToken,
  getEbayAuthStatus,
  isAuthEnabled,
  resetAuthState,
};
