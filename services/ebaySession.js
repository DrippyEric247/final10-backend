// server/services/ebaySession.js
const { refreshAccessToken } = require('./ebayTokenService');
const User = require('../models/User');

// in-memory cache (optional)
const cache = new Map(); // key: userId -> {access_token, exp}

async function getAccessTokenForUser(user) {
  // If user is just an ID object from middleware, fetch the full user
  let fullUser = user;
  if (user.id && !user.hasEbayConnected) {
    fullUser = await User.findById(user.id);
    if (!fullUser) {
      throw new Error('User not found');
    }
  }

  // Check if user has eBay connected and valid refresh token
  if (!fullUser.hasEbayConnected || !fullUser.hasEbayConnected()) {
    throw new Error('User does not have eBay account connected');
  }

  // Check if current access token is still valid
  if (fullUser.isEbayTokenValid && fullUser.isEbayTokenValid()) {
    return fullUser.ebayAuth.accessToken;
  }

  // Check cache first
  const cached = cache.get(user.id);
  const now = Date.now();

  if (cached && now < cached.exp - 120_000) {
    return cached.access_token;
  }

  // Refresh using the user's stored eBay refresh token
  if (!fullUser.ebayAuth.refreshToken) {
    throw new Error('No eBay refresh token available for user');
  }

  try {
    const data = await refreshAccessToken(fullUser.ebayAuth.refreshToken);
    const exp = now + data.expires_in * 1000;

    // Update user's access token in database
    await fullUser.updateEbayAccessToken(data.access_token, data.expires_in);

    // Update cache
    cache.set(fullUser.id, { access_token: data.access_token, exp });
    return data.access_token;
  } catch (error) {
    console.error('Failed to refresh eBay access token:', error);
    throw new Error('Failed to refresh eBay access token');
  }
}

module.exports = { getAccessTokenForUser };

