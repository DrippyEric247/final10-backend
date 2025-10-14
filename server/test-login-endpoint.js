const axios = require('axios');

async function testLoginEndpoint() {
  try {
    console.log('🧪 Testing Login Endpoint...\n');

    const baseURL = 'http://localhost:5000/api';
    
    // Test 1: Check if server is responding
    console.log('1️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get(`${baseURL}/health`);
      console.log('✅ Server is responding:', healthResponse.data);
    } catch (error) {
      console.log('❌ Server health check failed:', error.message);
      return;
    }

    // Test 2: Check if auth routes are accessible
    console.log('\n2️⃣ Testing auth routes accessibility...');
    try {
      // Try to access a non-existent endpoint to see if we get 404
      const testResponse = await axios.get(`${baseURL}/auth/test`);
      console.log('❌ Unexpected response from /auth/test:', testResponse.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Auth routes are properly configured (404 for non-existent endpoint)');
      } else {
        console.log('❌ Auth routes error:', error.response?.status, error.message);
      }
    }

    // Test 3: Test login endpoint with demo credentials
    console.log('\n3️⃣ Testing login endpoint...');
    try {
      const loginResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'demo@final10.com',
        password: 'demo123'
      });
      console.log('✅ Login successful!');
      console.log('   Token:', loginResponse.data.token ? 'Present' : 'Missing');
      console.log('   User:', loginResponse.data.user?.username || 'Missing');
    } catch (error) {
      console.log('❌ Login failed:');
      console.log('   Status:', error.response?.status);
      console.log('   Message:', error.response?.data?.message || error.message);
      console.log('   URL:', error.config?.url);
    }

    // Test 4: Test with invalid credentials
    console.log('\n4️⃣ Testing login with invalid credentials...');
    try {
      const invalidResponse = await axios.post(`${baseURL}/auth/login`, {
        email: 'invalid@example.com',
        password: 'wrongpassword'
      });
      console.log('❌ Unexpected success with invalid credentials');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Invalid credentials properly rejected (400)');
      } else {
        console.log('❌ Unexpected error with invalid credentials:', error.response?.status);
      }
    }

    // Test 5: Test login endpoint accessibility
    console.log('\n5️⃣ Testing login endpoint accessibility...');
    try {
      const optionsResponse = await axios.options(`${baseURL}/auth/login`);
      console.log('✅ Login endpoint accessible via OPTIONS');
    } catch (error) {
      console.log('❌ Login endpoint not accessible:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLoginEndpoint();

