const axios = require('axios');

async function testVideoScanner() {
  try {
    console.log('🧪 Testing Video Scanner Endpoint...');
    
    // Test video scanner endpoint with a valid token
    console.log('\n1️⃣ Testing video scanner endpoint...');
    try {
      // First, let's get a valid token by logging in
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'demo@example.com',
        password: 'password123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login successful, got token');
      
      // Now test the video scanner endpoint
      const response = await axios.get('http://localhost:5000/api/scanner/video', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          url: 'https://www.tiktok.com/@user/video/1234567890'
        }
      });
      
      console.log('✅ Video scanner endpoint works:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      console.log('❌ Video scanner endpoint failed:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVideoScanner();
