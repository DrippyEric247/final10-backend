const axios = require('axios');

async function testLevelsEndpoint() {
  try {
    console.log('🧪 Testing Levels Endpoint...');
    
    // Test levels/stats endpoint with a valid token
    console.log('\n1️⃣ Testing levels/stats endpoint...');
    try {
      // First, let's get a valid token by logging in
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'demo@example.com',
        password: 'password123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login successful, got token');
      
      // Now test the levels/stats endpoint
      const response = await axios.get('http://localhost:5000/api/levels/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Levels/stats endpoint works:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Levels/stats endpoint failed:', error.response?.status, error.response?.data);
    }

    // Test levels/me endpoint
    console.log('\n2️⃣ Testing levels/me endpoint...');
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'demo@example.com',
        password: 'password123'
      });
      
      const token = loginResponse.data.token;
      
      const response = await axios.get('http://localhost:5000/api/levels/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Levels/me endpoint works:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Levels/me endpoint failed:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLevelsEndpoint();

