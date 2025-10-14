// server/routes/ebayAuth.js
const express = require('express');
const { exchangeCodeForTokens } = require('../services/ebayTokenService');

const router = express.Router();

// GET /api/ebay-auth/start -> 302 redirect to eBay OAuth
router.get('/start', (req, res) => {
  const { EBAY_CLIENT_ID, EBAY_REDIRECT_URI } = process.env;
  const scope = encodeURIComponent('https://api.ebay.com/oauth/api_scope');
  const redirect = encodeURIComponent(EBAY_REDIRECT_URI);
  const url =
    `https://auth.ebay.com/oauth2/authorize?` +
    `client_id=${EBAY_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${redirect}&` +
    `scope=${scope}&` +
    `state=${encodeURIComponent('final10')}`;

  return res.redirect(302, url);
});

// GET /api/ebay-auth/callback?code=...
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const tokens = await exchangeCodeForTokens(code);

    // TODO: Save tokens to user - you'll need to identify the user somehow
    // For now, just redirect back to the app with success
    console.log('✅ eBay OAuth tokens received:', {
      access_token: tokens.access_token ? 'present' : 'missing',
      refresh_token: tokens.refresh_token ? 'present' : 'missing',
      expires_in: tokens.expires_in
    });

    // Redirect back to your app UI page with success
    return res.redirect('/profile?ebay=connected');
  } catch (err) {
    console.error('❌ OAuth callback error:', err?.response?.data || err.message);
    return res.redirect('/profile?ebay=error');
  }
});

module.exports = router;

