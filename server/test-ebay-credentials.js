// Run: node test-ebay-credentials.js  (from server/ with .env loaded)
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const {
  getEbayAppToken,
  getEbayAuthStatus,
  logEbayAuthStartupCheck,
} = require('./services/ebayAuthService');

async function main() {
  logEbayAuthStartupCheck();
  const status = getEbayAuthStatus();
  console.log('\n--- eBay auth status ---');
  console.log(JSON.stringify(status, null, 2));

  console.log('\n--- Token request ---');
  const token = await getEbayAppToken();
  if (token) {
    console.log('✅ App token obtained (length', token.length, ')');
    process.exit(0);
  } else {
    console.error('❌ App token unavailable');
    console.error('Last failure:', status.lastFailureReason);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
