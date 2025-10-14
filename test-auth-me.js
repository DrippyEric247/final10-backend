const axios = require('axios');

async function testAuthMe() {
  try {
    console.log('🧪 Testing /auth/me endpoint...');
    
    // Test without token first
    console.log('\n1️⃣ Testing /auth/me without token...');
    try {
      const response = await axios.get('http://localhost:5000/api/auth/me');
      console.log('✅ Response:', response.data);
    } catch (error) {
      console.log('❌ Expected error (no token):', error.response?.status, error.response?.data);
    }

    // Test with invalid token
    console.log('\n2️⃣ Testing /auth/me with invalid token...');
    try {
      const response = await axios.get('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      console.log('✅ Response:', response.data);
    } catch (error) {
      console.log('❌ Expected error (invalid token):', error.response?.status, error.response?.data);
    }

    // Test with valid token (if we can get one)
    console.log('\n3️⃣ Testing /auth/me with valid token...');
    try {
      // Try to login first
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'demo@example.com',
        password: 'password123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login successful, got token');
      
      // Now test /auth/me
      const response = await axios.get('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ /auth/me response:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ /auth/me failed:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuthMe();
