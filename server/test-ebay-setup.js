// Test script to verify eBay API setup
require('dotenv').config();

const { getEbayAccessToken } = require('./services/ebayAuth');

async function testEbaySetup() {
  console.log('🔍 Testing eBay API Setup...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('EBAY_CLIENT_ID:', process.env.EBAY_CLIENT_ID ? '✅ SET' : '❌ NOT SET');
  console.log('EBAY_CLIENT_SECRET:', process.env.EBAY_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET');
  console.log('');
  
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log('❌ eBay credentials not configured!');
    console.log('');
    console.log('📝 To fix this:');
    console.log('1. Go to https://developer.ebay.com/');
    console.log('2. Sign in with your eBay account');
    console.log('3. Go to "My Account" > "Applications"');
    console.log('4. Create a new application or use existing one');
    console.log('5. Copy the Client ID and Client Secret');
    console.log('6. Add them to your .env file:');
    console.log('   EBAY_CLIENT_ID=your_client_id_here');
    console.log('   EBAY_CLIENT_SECRET=your_client_secret_here');
    console.log('');
    console.log('📄 Create a .env file in the server directory with:');
    console.log('MONGODB_URI=mongodb://localhost:27017/final10');
    console.log('PORT=5000');
    console.log('NODE_ENV=development');
    console.log('EBAY_CLIENT_ID=your_ebay_client_id_here');
    console.log('EBAY_CLIENT_SECRET=your_ebay_client_secret_here');
    console.log('JWT_SECRET=your_jwt_secret_here');
    return;
  }
  
  // Test token request
  console.log('🔑 Testing eBay token request...');
  try {
    const token = await getEbayAccessToken();
    console.log('✅ eBay token obtained successfully!');
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 20) + '...');
  } catch (error) {
    console.log('❌ eBay token request failed:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data);
    console.log('');
    console.log('🔧 Possible solutions:');
    console.log('1. Verify your eBay credentials are correct');
    console.log('2. Make sure your eBay app has the correct scopes enabled');
    console.log('3. Check if you\'re using sandbox or production credentials');
    console.log('4. Ensure your eBay app is approved for the buy.browse scope');
  }
}

testEbaySetup().catch(console.error);

