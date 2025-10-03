const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

async function debugAuthToken() {
  try {
    console.log('🔍 Debugging Auth Token Issues...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/final10');
    console.log('✅ Connected to MongoDB\n');

    const baseURL = 'http://localhost:5000/api';
    
    // Test different token scenarios that might cause hydration failures
    console.log('🧪 Testing various token scenarios...\n');
    
    // 1. Test with no token
    console.log('1️⃣ Testing with no Authorization header...');
    try {
      const noTokenResponse = await axios.get(`${baseURL}/auth/me`);
      console.log('❌ Should have failed but got:', noTokenResponse.data);
    } catch (noTokenError) {
      console.log('✅ No token correctly rejected');
      console.log('Status:', noTokenError.response?.status);
      console.log('Message:', noTokenError.response?.data?.message);
    }
    
    // 2. Test with empty token
    console.log('\n2️⃣ Testing with empty token...');
    try {
      const emptyTokenResponse = await axios.get(`${baseURL}/auth/me`, {
        headers: {
          'Authorization': `Bearer `,
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ Should have failed but got:', emptyTokenResponse.data);
    } catch (emptyTokenError) {
      console.log('✅ Empty token correctly rejected');
      console.log('Status:', emptyTokenError.response?.status);
      console.log('Message:', emptyTokenError.response?.data?.message);
    }
    
    // 3. Test with just "Bearer" (no token)
    console.log('\n3️⃣ Testing with just "Bearer"...');
    try {
      const justBearerResponse = await axios.get(`${baseURL}/auth/me`, {
        headers: {
          'Authorization': `Bearer`,
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ Should have failed but got:', justBearerResponse.data);
    } catch (justBearerError) {
      console.log('✅ Just "Bearer" correctly rejected');
      console.log('Status:', justBearerError.response?.status);
      console.log('Message:', justBearerError.response?.data?.message);
    }
    
    // 4. Test with a token that looks valid but is for a non-existent user
    console.log('\n4️⃣ Testing with token for non-existent user...');
    try {
      // Create a fake JWT token (this will fail when decoded)
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZGEwYjNiNzZlNDViZjk2MWJiYTllZiIsImlhdCI6MTczNTQ4MjUyOCwiZXhwIjoxNzM1NDg2MTI4fQ.fake_signature';
      
      const fakeTokenResponse = await axios.get(`${baseURL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${fakeToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('❌ Should have failed but got:', fakeTokenResponse.data);
    } catch (fakeTokenError) {
      console.log('✅ Fake token correctly rejected');
      console.log('Status:', fakeTokenError.response?.status);
      console.log('Message:', fakeTokenError.response?.data?.message);
    }
    
    // 5. Test with a valid token but check if user still exists
    console.log('\n5️⃣ Testing with valid token...');
    try {
      const loginResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Got valid token');
      
      const meResponse = await axios.get(`${baseURL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Valid token works correctly');
      console.log('User ID:', meResponse.data.id);
      console.log('Username:', meResponse.data.username);
      
    } catch (validTokenError) {
      console.log('❌ Valid token failed:', validTokenError.response?.data?.message || validTokenError.message);
    }
    
    // 6. Check if there are any issues with the JWT secret
    console.log('\n6️⃣ Checking JWT configuration...');
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.log('❌ JWT_SECRET is not set in environment variables');
    } else {
      console.log('✅ JWT_SECRET is configured');
      console.log('Secret length:', jwtSecret.length);
    }

    console.log('\n🎉 Auth token debugging complete!');
    console.log('\n💡 Common causes of auth hydration failures:');
    console.log('   - Invalid or expired token in localStorage');
    console.log('   - Token for deleted user');
    console.log('   - Malformed token');
    console.log('   - Missing JWT_SECRET');
    console.log('   - Network connectivity issues');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the debug
debugAuthToken();


