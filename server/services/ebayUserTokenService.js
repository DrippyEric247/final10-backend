const { getAccessTokenForUser } = require('./ebaySession');

async function getUserAccessToken(user) {
  return getAccessTokenForUser(user);
}

function getUserEbayConnectionStatus(user) {
  if (!user || !user.getEbayAuthStatus) {
    return {
      status: 'not_connected',
      isConnected: false,
      tokenExpired: false,
    };
  }
  const auth = user.getEbayAuthStatus();
  if (!auth.isConnected) {
    return { status: 'not_connected', isConnected: false, tokenExpired: false };
  }
  if (!auth.hasValidToken) {
    return { status: 'token_expired', isConnected: true, tokenExpired: true };
  }
  return { status: 'connected', isConnected: true, tokenExpired: false };
}

module.exports = {
  getUserAccessToken,
  getUserEbayConnectionStatus,
};

