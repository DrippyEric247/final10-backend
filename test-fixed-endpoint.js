const axios = require('axios');

async function testFixedEndpoint() {
  try {
    console.log('🧪 Testing Fixed API Endpoint...');
    
    // Test daily tasks endpoint with a valid token
    console.log('\n1️⃣ Testing daily tasks endpoint...');
    try {
      // First, let's get a valid token by logging in
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'demo@example.com',
        password: 'password123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login successful, got token');
      
      // Now test the daily tasks endpoint
      const response = await axios.get('http://localhost:5000/api/auctions/daily-tasks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Daily tasks endpoint works:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Daily tasks endpoint failed:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFixedEndpoint();

