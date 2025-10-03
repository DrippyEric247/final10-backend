// Test script to verify eBay credentials and API access
require('dotenv').config();

const { getEbayAccessToken, isAuthEnabled } = require('./services/ebayAuth');
const axios = require('axios');

async function testEbayCredentials() {
  console.log('🔍 Testing eBay Credentials and API Access...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('EBAY_CLIENT_ID:', process.env.EBAY_CLIENT_ID ? '✅ SET' : '❌ NOT SET');
  console.log('EBAY_CLIENT_SECRET:', process.env.EBAY_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET');
  
  if (process.env.EBAY_CLIENT_ID) {
    console.log('Client ID preview:', process.env.EBAY_CLIENT_ID.substring(0, 8) + '...');
  }
  if (process.env.EBAY_CLIENT_SECRET) {
    console.log('Client Secret preview:', process.env.EBAY_CLIENT_SECRET.substring(0, 8) + '...');
  }
  console.log('');
  
  if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
    console.log('❌ eBay credentials not found in environment variables!');
    console.log('');
    console.log('📝 To fix this:');
    console.log('1. Make sure you have a .env file in the server directory');
    console.log('2. Add your eBay credentials to the .env file:');
    console.log('   EBAY_CLIENT_ID=your_actual_client_id');
    console.log('   EBAY_CLIENT_SECRET=your_actual_client_secret');
    console.log('3. Restart your server after adding the credentials');
    return;
  }
  
  // Test token request
  console.log('🔑 Testing eBay token request...');
  try {
    const token = await getEbayAccessToken();
    if (token) {
      console.log('✅ eBay token obtained successfully!');
      console.log('Token length:', token.length);
      console.log('Token preview:', token.substring(0, 20) + '...');
      console.log('Auth enabled:', isAuthEnabled());
      
      // Test a real API call
      console.log('\n🔍 Testing real eBay API call...');
      try {
        const response = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            q: 'iPhone',
            limit: 3,
            filter: 'buyingOptions:{AUCTION}'
          }
        });
        
        console.log('✅ Real eBay API call successful!');
        console.log('Items found:', response.data.itemSummaries?.length || 0);
        if (response.data.itemSummaries?.length > 0) {
          console.log('First item:', response.data.itemSummaries[0].title);
        }
        
      } catch (apiError) {
        console.log('❌ eBay API call failed:');
        console.log('Status:', apiError.response?.status);
        console.log('Error:', apiError.response?.data);
        
        if (apiError.response?.data?.errors) {
          const error = apiError.response.data.errors[0];
          if (error.errorId === 1100) {
            console.log('\n🔧 This is a permissions issue. Your app needs the buy.browse scope enabled.');
            console.log('Go to your eBay developer account and enable the buy.browse scope.');
          }
        }
      }
      
    } else {
      console.log('❌ No token obtained');
    }
  } catch (error) {
    console.log('❌ eBay token request failed:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data);
    console.log('Message:', error.message);
  }
}

testEbayCredentials().catch(console.error);


