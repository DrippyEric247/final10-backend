const axios = require('axios');

let cachedToken = null;
let tokenExp = 0;
let authEnabled = true;

// Function to reset authentication state (useful for testing)
function resetAuthState() {
  cachedToken = null;
  tokenExp = 0;
  authEnabled = true;
}

async function getEbayAccessToken() {
  // Check if credentials are available
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log('⚠️ eBay credentials not configured, using mock data');
    authEnabled = false;
    return null;
  }

  const now = Date.now();
  if (cachedToken && now < tokenExp - 60_000) return cachedToken;

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    
    // Try different scopes in order of preference
    const scopes = [
      'https://api.ebay.com/oauth/api_scope/buy.browse',
      'https://api.ebay.com/oauth/api_scope/buy.item.feed',
      'https://api.ebay.com/oauth/api_scope'
    ];
    
    let lastError = null;
    
    for (const scope of scopes) {
      try {
        console.log(`🔑 Trying scope: ${scope}`);
        
        const scopeParams = new URLSearchParams();
        scopeParams.append('grant_type', 'client_credentials');
        scopeParams.append('scope', scope);
        
        const { data } = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', scopeParams, {
          auth: {
            username: process.env.EBAY_CLIENT_ID,
            password: process.env.EBAY_CLIENT_SECRET,
          },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        cachedToken = data.access_token;
        tokenExp = now + data.expires_in * 1000;
        console.log(`✅ eBay access token obtained successfully with scope: ${scope}`);
        return cachedToken;
        
      } catch (scopeError) {
        console.log(`❌ Scope ${scope} failed:`, scopeError.response?.data?.error_description || scopeError.message);
        lastError = scopeError;
        continue;
      }
    }
    
    // If all scopes failed, throw the last error
    throw lastError;
    
  } catch (error) {
    console.error('❌ All eBay token requests failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // If authentication fails, disable auth and use mock data
    console.log('⚠️ Falling back to mock data due to authentication failure');
    authEnabled = false;
    return null;
  }
}

function isAuthEnabled() {
  return authEnabled;
}

module.exports = { getEbayAccessToken, isAuthEnabled, resetAuthState };


