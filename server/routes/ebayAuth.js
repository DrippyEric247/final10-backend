// server/routes/ebayAuth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { exchangeCodeForTokens } = require('../services/ebayTokenService');
const User = require('../models/User');
const { getUserEbayConnectionStatus } = require('../services/ebayUserTokenService');

const router = express.Router();

router.get('/status', auth, async (req, res) => {
  const user = req.user;
  const base = getUserEbayConnectionStatus(user);
  return res.json({
    success: true,
    ...base,
    ebay: user?.getEbayAuthStatus ? user.getEbayAuthStatus() : null,
  });
});

// GET /api/ebay-auth/start -> 302 redirect to eBay OAuth
function buildAuthUrl(user, returnTo) {
  const { EBAY_CLIENT_ID, EBAY_REDIRECT_URI } = process.env;
  const scope = encodeURIComponent(
    'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/buy.offer.auction'
  );
  const redirect = encodeURIComponent(EBAY_REDIRECT_URI);
  const payload = {
    uid: String(user?._id || user?.id || ''),
    ts: Date.now(),
    returnTo: String(returnTo || '/profile?ebay=connected'),
  };
  const state = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
  return (
    `https://auth.ebay.com/oauth2/authorize?` +
    `client_id=${EBAY_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${redirect}&` +
    `scope=${scope}&` +
    `state=${encodeURIComponent(state)}`
  );
}

router.get('/link', auth, (req, res) => {
  const url = buildAuthUrl(req.user, req.query.returnTo);
  return res.json({ success: true, url });
});

router.get('/start', auth, (req, res) => {
  const url = buildAuthUrl(req.user, req.query.returnTo);

  return res.redirect(302, url);
});

// GET /api/ebay-auth/callback?code=...
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Missing code');
    if (!state) return res.status(400).send('Missing state');

    const decoded = jwt.verify(String(state), process.env.JWT_SECRET);
    const userId = decoded?.uid;
    if (!userId) return res.status(400).send('Invalid state');

    const tokens = await exchangeCodeForTokens(code);
    const user = await User.findById(userId);
    if (!user) return res.status(404).send('User not found');

    const scopes = String(tokens.scope || '')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    await user.setEbayTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: Number(tokens.expires_in || 0),
      scopes,
    });

    console.log('✅ eBay OAuth tokens received:', {
      userId: String(user._id),
      access_token: tokens.access_token ? 'present' : 'missing',
      refresh_token: tokens.refresh_token ? 'present' : 'missing',
      expires_in: tokens.expires_in
    });

    const returnTo = decoded?.returnTo || '/profile?ebay=connected';
    return res.redirect(returnTo);
  } catch (err) {
    console.error('❌ OAuth callback error:', err?.response?.data || err.message);
    return res.redirect('/profile?ebay=error');
  }
});

router.post('/disconnect', auth, async (req, res) => {
  await req.user.clearEbayAuth();
  return res.json({ success: true, status: 'not_connected' });
});

module.exports = router;

