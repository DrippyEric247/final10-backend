const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;

let ebayAppToken = null;
let ebayTokenExpiresAt = 0;

async function getEbayAppToken() {
  const now = Date.now();

  if (ebayAppToken && now < ebayTokenExpiresAt - 60_000) {
    return ebayAppToken;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const scope = process.env.EBAY_SCOPE || 'https://api.ebay.com/oauth/api_scope';

  if (!clientId || !clientSecret) {
    throw new Error('Missing eBay production credentials');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope,
    }).toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('eBay token error:', data);
    throw new Error('Failed to generate eBay app token');
  }

  ebayAppToken = data.access_token;
  ebayTokenExpiresAt = now + (data.expires_in || 7200) * 1000;

  return ebayAppToken;
}

module.exports = { getEbayAppToken };

