const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function testAuthMe() {
  try {
    console.log('🔐 Testing /api/auth/me endpoint...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    const baseURL = 'http://localhost:5000/api';
    
    // First, login to get a token
    console.log('🔑 Logging in to get token...');
    try {
      const loginResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login successful');
      console.log(`Token: ${token.substring(0, 20)}...`);
      console.log(`User: ${loginResponse.data.user.username}`);
      
      // Test the /auth/me endpoint
      console.log('\n🧪 Testing /api/auth/me endpoint...');
      const meResponse = await axios.get(`${baseURL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ /auth/me endpoint successful!');
      console.log('Status:', meResponse.status);
      console.log('Response data:', meResponse.data);
      
      // Test with invalid token
      console.log('\n🧪 Testing with invalid token...');
      try {
        const invalidResponse = await axios.get(`${baseURL}/auth/me`, {
          headers: {
            'Authorization': `Bearer invalid_token_123`,
            'Content-Type': 'application/json'
          }
        });
        console.log('❌ Should have failed but got:', invalidResponse.data);
      } catch (invalidError) {
        console.log('✅ Invalid token correctly rejected');
        console.log('Status:', invalidError.response?.status);
        console.log('Message:', invalidError.response?.data?.message);
      }
      
      // Test with expired token (if we can simulate one)
      console.log('\n🧪 Testing with malformed token...');
      try {
        const malformedResponse = await axios.get(`${baseURL}/auth/me`, {
          headers: {
            'Authorization': `Bearer malformed.token.here`,
            'Content-Type': 'application/json'
          }
        });
        console.log('❌ Should have failed but got:', malformedResponse.data);
      } catch (malformedError) {
        console.log('✅ Malformed token correctly rejected');
        console.log('Status:', malformedError.response?.status);
        console.log('Message:', malformedError.response?.data?.message);
      }
      
    } catch (loginError) {
      console.log('❌ Login failed:', loginError.response?.data?.message || loginError.message);
      console.log('Status:', loginError.response?.status);
    }

    console.log('\n🎉 Auth /me endpoint test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the test
testAuthMe();


