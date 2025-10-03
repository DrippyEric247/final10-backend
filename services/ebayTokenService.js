// server/services/ebayTokenService.js
const axios = require('axios');
const qs = require('querystring');

const EBAY_OAUTH_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';

function basicAuthHeader() {
  const b64 = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString('base64');
  return `Basic ${b64}`;
}

// Exchange authorization code -> access + refresh tokens
async function exchangeCodeForTokens(code) {
  const body = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.EBAY_REDIRECT_URI,
  };

  const { data } = await axios.post(EBAY_OAUTH_TOKEN_URL, qs.stringify(body), {
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  // data = { access_token, expires_in, refresh_token, refresh_token_expires_in, token_type, ... }
  return data;
}

// Use refresh_token -> new access_token
async function refreshAccessToken(refreshToken) {
  const body = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: process.env.EBAY_SCOPE
  };

  const { data } = await axios.post(EBAY_OAUTH_TOKEN_URL, qs.stringify(body), {
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return data; // { access_token, expires_in, token_type, ... }
}

module.exports = { exchangeCodeForTokens, refreshAccessToken };

